import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, LinearProgress, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import PhoneIcon from "@mui/icons-material/Phone";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import AllInclusiveIcon from "@mui/icons-material/AllInclusive";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface UsageChannel { channel: string; used: number; limit: number; displayName: string; }
interface UsageMonitor { year: number; month: number; channels: UsageChannel[]; }
interface EmailLogEntry {
  at: string;
  source: string;       // "Newsletter" | "PasswordReset" | "Notification" | "Support" | "Comm"
  subject: string;
  recipient: string;
  recipientCount: number;
  status: string;
  tenantId: string | null;
  tenantName: string | null;
}

const CHANNEL_ICON: Record<string, JSX.Element> = {
  email: <EmailIcon />,
  sms:   <SmsIcon />,
  viber: <ChatBubbleIcon />,
  phone: <PhoneIcon />,
};

const MONTH_NAMES = [
  "", "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"
];

/**
 * Profile card that shows the user's current-month outgoing communications.
 *
 * Regular users see a per-channel progress bar against the platform limit,
 * with a "pay for more" dialog when a channel hits capacity.
 *
 * PlatformAdmin gets the same counters WITHOUT limits (they run the platform
 * — quotas don't apply to them) and a live outbound email log fed from the
 * platform-wide newsletter campaign history.
 */
export function UsageMonitorSection() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "PlatformAdmin";
  const [upgradeChannel, setUpgradeChannel] = useState<UsageChannel | null>(null);
  const q = useQuery({
    queryKey: ["me-usage-monitor"],
    queryFn: async () => (await api.get<UsageMonitor>("/me/usage-monitor")).data
  });
  // Broader email log — covers newsletter + password resets + notifications
  // + support ticket notifications, not just newsletter campaigns.
  const emailLogQ = useQuery({
    queryKey: ["platform-emails-recent"],
    enabled: isPlatformAdmin,
    queryFn: async () => (await api.get<EmailLogEntry[]>("/platform/emails/recent", { params: { limit: 30 } })).data,
    refetchInterval: 30_000  // live-ish — email history isn't chatty enough to need websockets
  });

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center",
              bgcolor: "rgba(11,37,69,0.06)", color: "primary.main"
            }}>
              <BarChartIcon />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                Χρήση επικοινωνιών αυτού του μήνα
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                {q.data ? `${MONTH_NAMES[q.data.month]} ${q.data.year}` : "Φόρτωση…"} — email, SMS, Viber
                και τηλεφωνικές κλήσεις που έχετε καταγράψει.
              </Typography>
            </Box>
            {isPlatformAdmin && (
              <Chip color="success" icon={<AllInclusiveIcon />} label="Απεριόριστη ποσόστωση" sx={{ fontWeight: 700 }} />
            )}
          </Stack>

          {q.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
          ) : q.isError ? (
            <Alert severity="error">Αδυναμία φόρτωσης χρήσης.</Alert>
          ) : (
            <Stack spacing={1.75}>
              {(q.data?.channels ?? []).map(c => {
                const pct = c.limit > 0 ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 0;
                const over = !isPlatformAdmin && c.limit > 0 && c.used >= c.limit;
                const warning = !isPlatformAdmin && !over && pct >= 80;
                return (
                  <Box key={c.channel}>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                      <Box sx={{ color: over ? "error.main" : warning ? "warning.main" : "text.secondary" }}>
                        {CHANNEL_ICON[c.channel] ?? <BarChartIcon />}
                      </Box>
                      <Typography sx={{ flex: 1, fontWeight: 600 }}>{c.displayName}</Typography>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700,
                        color: over ? "error.main" : "text.primary" }}>
                        {isPlatformAdmin ? `${c.used}` : `${c.used} / ${c.limit}`}
                      </Typography>
                      {isPlatformAdmin && (
                        <Chip size="small" color="success" variant="outlined" label="χωρίς όριο" />
                      )}
                      {over && (
                        <Chip size="small" color="error" label="Όριο" sx={{ fontWeight: 800 }} />
                      )}
                      {warning && !over && (
                        <Chip size="small" color="warning" label="Κοντά στο όριο" sx={{ fontWeight: 800 }} />
                      )}
                      {over && (
                        <Button size="small" variant="outlined" color="error"
                          startIcon={<UpgradeIcon fontSize="small" />}
                          onClick={() => setUpgradeChannel(c)}>
                          Πληρωμή
                        </Button>
                      )}
                    </Stack>
                    {!isPlatformAdmin && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        color={over ? "error" : warning ? "warning" : "primary"}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>

        <Dialog open={!!upgradeChannel} onClose={() => setUpgradeChannel(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <UpgradeIcon color="warning" />
              <span>Ξεπεράσατε το όριο</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 1.5 }}>
              Έχετε χρησιμοποιήσει <b>{upgradeChannel?.used}</b> από τα <b>{upgradeChannel?.limit}</b>
              {" "}<b>{upgradeChannel?.displayName}</b> που περιλαμβάνει το πακέτο σας γι' αυτόν τον μήνα.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Για επιπλέον όγκο, επικοινωνήστε με τον διαχειριστή του γραφείου σας ή αναβαθμίστε το πακέτο
              σας από τις Ρυθμίσεις. Το ανώτατο ανά μήνα καθορίζεται από τον Διαχειριστή Πλατφόρμας.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => setUpgradeChannel(null)}>Κατάλαβα</Button>
          </DialogActions>
        </Dialog>
      </Card>

      {isPlatformAdmin && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} mb={2}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center",
                bgcolor: "rgba(11,37,69,0.06)", color: "primary.main"
              }}>
                <EmailIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                  Live email log (πλατφόρμα)
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                  Όλες οι εξερχόμενες αποστολές email — καμπάνιες, ενημερώσεις κωδικού, notifications, support. Ανανέωση κάθε 30″.
                </Typography>
              </Box>
              <Chip size="small" color={emailLogQ.isFetching ? "info" : "default"}
                label={emailLogQ.isFetching ? "Ανανέωση…" : "Ζωντανά"} variant="outlined" />
            </Stack>

            {emailLogQ.isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
            ) : (emailLogQ.data ?? []).length === 0 ? (
              <Alert severity="info" sx={{ mb: 0 }}>
                Καμία καταγραφή email αποστολής προς το παρόν.
              </Alert>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Πηγή</TableCell>
                      <TableCell>Θέμα</TableCell>
                      <TableCell>Παραλήπτης</TableCell>
                      <TableCell>Γραφείο</TableCell>
                      <TableCell>Κατάσταση</TableCell>
                      <TableCell align="right">Ημ/νία</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(emailLogQ.data ?? []).map((e, i) => (
                      <TableRow key={`${e.at}-${i}`} hover>
                        <TableCell>
                          <Chip size="small" variant="outlined" label={e.source} />
                        </TableCell>
                        <TableCell><Typography fontWeight={600}>{e.subject}</Typography></TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {e.recipient}
                          {e.recipientCount > 1 && (
                            <Typography variant="caption" color="text.secondary"> ({e.recipientCount})</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{e.tenantName ?? "—"}</TableCell>
                        <TableCell>
                          <Chip size="small"
                            color={e.status === "Sent" ? "success" : e.status === "Failed" ? "error" : "default"}
                            variant={e.status === "Sent" || e.status === "Failed" ? "filled" : "outlined"}
                            label={e.status} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: "nowrap", fontSize: 12, color: "text.secondary" }}>
                          {new Date(e.at).toLocaleString("el-GR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
