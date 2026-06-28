import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmailIcon from "@mui/icons-material/Email";
import { PREMIUM_FEATURE_CATALOGUE, usePremium, type PremiumFeatureCode } from "../auth/PremiumContext";

/**
 * Reads the focused feature out of <PremiumContext /> and renders the upgrade
 * pitch. Mounted ONCE near the root (App.tsx) — every promptUpgrade() call
 * surfaces it.
 */
export function UpgradePlanDialogHost() {
  const premium = usePremium();
  const open = premium._dialogOpen;
  const focusCode = premium._dialogFocus;
  const focusMeta = focusCode ? PREMIUM_FEATURE_CATALOGUE[focusCode] : null;

  const allCodes = Object.keys(PREMIUM_FEATURE_CATALOGUE) as PremiumFeatureCode[];
  const subject = focusMeta
    ? `Kalypsis · Αναβάθμιση πλάνου · ${focusMeta.label}`
    : "Kalypsis · Αναβάθμιση πλάνου";
  const body = focusMeta
    ? `Καλημέρα,\n\nΘα ήθελα να ενεργοποιήσω το premium feature «${focusMeta.label}» στο λογαριασμό μου.\n\nΕυχαριστώ.`
    : "Καλημέρα,\n\nΘα ήθελα να δω τις διαθέσιμες αναβαθμίσεις premium στο λογαριασμό μου.\n\nΕυχαριστώ.";
  const mailto = `mailto:hello@kalypsis.gr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Dialog
      open={open}
      onClose={premium._closeDialog}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 44, height: 44, borderRadius: 2.5,
            display: "grid", placeItems: "center",
            background: "linear-gradient(135deg, #f5d27c 0%, #b08a3e 100%)",
            color: "#3a2a05"
          }}>
            <WorkspacePremiumIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 850, fontSize: 22 }}>Αναβάθμιση πλάνου</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14 }}>
              Premium δυνατότητες για επαγγελματίες της ασφάλισης
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={premium._closeDialog}
          sx={{ position: "absolute", right: 12, top: 12 }}
          aria-label="Κλείσιμο"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {focusMeta && (
          <Alert
            icon={<WorkspacePremiumIcon />}
            severity="warning"
            sx={{ mb: 2.5, alignItems: "center", bgcolor: "rgba(245,210,124,0.12)", color: "#5a4612", borderColor: "rgba(176,138,62,0.4)" }}
            variant="outlined"
          >
            Η δυνατότητα <strong>{focusMeta.label}</strong> δεν είναι ενεργοποιημένη στο πλάνο σας.
            Επικοινωνήστε μαζί μας για ενεργοποίηση από <strong>{focusMeta.monthlyPriceEUR}€ / μήνα</strong>.
          </Alert>
        )}
        <Stack spacing={1.5}>
          {allCodes.map((code) => {
            const meta = PREMIUM_FEATURE_CATALOGUE[code];
            const granted = premium.has(code);
            const focused = focusCode === code;
            return (
              <Card
                key={code}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: focused ? "#b08a3e" : "divider",
                  borderWidth: focused ? 2 : 1,
                  background: focused ? "rgba(245,210,124,0.06)" : "background.paper"
                }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1.5}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2,
                    display: "grid", placeItems: "center",
                    bgcolor: granted ? "rgba(46,164,79,0.12)" : "rgba(176,138,62,0.10)",
                    color: granted ? "#1e7a32" : "#7a5b1c",
                    flexShrink: 0
                  }}>
                    {granted ? <CheckCircleIcon /> : <WorkspacePremiumIcon />}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={800} fontSize={16}>{meta.label}</Typography>
                    <Typography color="text.secondary" fontSize={14}>{meta.description}</Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", minWidth: 110 }}>
                    {granted ? (
                      <Chip size="small" color="success" label="Ενεργό" sx={{ fontWeight: 800 }} />
                    ) : (
                      <>
                        <Typography fontSize={18} fontWeight={850} color="#7a5b1c">
                          {meta.monthlyPriceEUR}€
                        </Typography>
                        <Typography fontSize={11} color="text.secondary">ανά μήνα</Typography>
                      </>
                    )}
                  </Box>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={premium._closeDialog}>Άκυρο</Button>
        <Button
          component="a"
          href={mailto}
          variant="contained"
          startIcon={<EmailIcon />}
          sx={{
            background: "linear-gradient(135deg, #b08a3e 0%, #7a5b1c 100%)",
            fontWeight: 800,
            "&:hover": { background: "linear-gradient(135deg, #c79a4a 0%, #8a6b22 100%)" }
          }}
        >
          Επικοινωνία για αναβάθμιση
        </Button>
      </DialogActions>
    </Dialog>
  );
}
