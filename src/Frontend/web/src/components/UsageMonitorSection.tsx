import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, LinearProgress, Stack, Typography
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import PhoneIcon from "@mui/icons-material/Phone";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface UsageChannel { channel: string; used: number; limit: number; displayName: string; }
interface UsageMonitor { year: number; month: number; channels: UsageChannel[]; }

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
 * Card in the profile page that shows the user's current-month outgoing
 * communications per channel with a progress bar against the platform limit.
 * When any channel hits capacity we pop a small dialog inviting the user to
 * ask the admin for more quota — actual purchase flow is out of scope for
 * this MVP, we just surface the friction point.
 */
export function UsageMonitorSection() {
  const [upgradeChannel, setUpgradeChannel] = useState<UsageChannel | null>(null);
  const q = useQuery({
    queryKey: ["me-usage-monitor"],
    queryFn: async () => (await api.get<UsageMonitor>("/me/usage-monitor")).data
  });

  return (
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
        </Stack>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
        ) : q.isError ? (
          <Alert severity="error">Αδυναμία φόρτωσης χρήσης.</Alert>
        ) : (
          <Stack spacing={1.75}>
            {(q.data?.channels ?? []).map(c => {
              const pct = c.limit > 0 ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 0;
              const over = c.limit > 0 && c.used >= c.limit;
              const warning = !over && pct >= 80;
              return (
                <Box key={c.channel}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                    <Box sx={{ color: over ? "error.main" : warning ? "warning.main" : "text.secondary" }}>
                      {CHANNEL_ICON[c.channel] ?? <BarChartIcon />}
                    </Box>
                    <Typography sx={{ flex: 1, fontWeight: 600 }}>{c.displayName}</Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700,
                      color: over ? "error.main" : "text.primary" }}>
                      {c.used} / {c.limit}
                    </Typography>
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
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color={over ? "error" : warning ? "warning" : "primary"}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
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
  );
}
