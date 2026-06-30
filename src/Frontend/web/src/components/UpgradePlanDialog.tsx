import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { PREMIUM_FEATURE_CATALOGUE, usePremium, type PremiumFeatureCode } from "../auth/PremiumContext";

type Cycle = "monthly" | "yearly";
/** Yearly = 10× monthly (2 months free). Tweak if the company decides on a
 *  different discount later — single source of truth. */
const YEARLY_MULTIPLIER = 10;

const NAVY = "#0b2545";
const NAVY_SOFT = "#3d4f6b";
const ACCENT = "#1ea7e1";
const RULE = "#e5e9ef";

/**
 * Restrained upgrade dialog — same palette as the landing / contact pages.
 * No gradients, minimal icons, plain typography. Lists each premium feature
 * with its monthly price and an email CTA to info@mykalypsis.gr.
 */
export function UpgradePlanDialogHost() {
  const premium = usePremium();
  const open = premium._dialogOpen;
  const focusCode = premium._dialogFocus;
  const focusMeta = focusCode ? PREMIUM_FEATURE_CATALOGUE[focusCode] : null;
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const priceFor = (monthly: number) => cycle === "yearly" ? monthly * YEARLY_MULTIPLIER : monthly;
  const periodLabel = cycle === "yearly" ? "/ έτος" : "/ μήνα";

  const allCodes = Object.keys(PREMIUM_FEATURE_CATALOGUE) as PremiumFeatureCode[];
  const subject = focusMeta
    ? `Kalypsis · Αναβάθμιση πλάνου · ${focusMeta.label}`
    : "Kalypsis · Αναβάθμιση πλάνου";
  const body = focusMeta
    ? `Καλημέρα,\n\nΘα ήθελα να ενεργοποιήσω το premium feature «${focusMeta.label}» στο λογαριασμό μου.\n\nΕυχαριστώ.`
    : "Καλημέρα,\n\nΘα ήθελα να δω τις διαθέσιμες αναβαθμίσεις premium στο λογαριασμό μου.\n\nΕυχαριστώ.";
  const mailto = `mailto:info@mykalypsis.gr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Dialog
      open={open}
      onClose={premium._closeDialog}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, border: `1px solid ${RULE}` } } }}
    >
      <DialogTitle sx={{ pr: 6, pb: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, color: NAVY }}>
          Αναβάθμιση πλάνου
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: NAVY_SOFT, mt: 0.25 }}>
          Premium δυνατότητες για επαγγελματίες της ασφάλισης
        </Typography>
        <IconButton
          onClick={premium._closeDialog}
          sx={{ position: "absolute", right: 10, top: 10, color: NAVY_SOFT }}
          aria-label="Κλείσιμο"
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: RULE }}>
        <Stack direction="row" justifyContent="center" mb={2}>
          <ToggleButtonGroup
            value={cycle}
            exclusive
            size="small"
            onChange={(_, v) => v && setCycle(v as Cycle)}
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none", fontWeight: 700, fontSize: 13,
                px: 2.5, color: NAVY_SOFT, borderColor: RULE,
                "&.Mui-selected": {
                  bgcolor: NAVY, color: "#fff",
                  "&:hover": { bgcolor: NAVY }
                }
              }
            }}
          >
            <ToggleButton value="monthly">Μηνιαία</ToggleButton>
            <ToggleButton value="yearly">
              Ετήσια
              <Chip size="small" label="-17%" sx={{
                ml: 1, height: 18, fontSize: 10, fontWeight: 800,
                bgcolor: "rgba(46,164,79,0.15)", color: "#1e7a32"
              }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {focusMeta && (
          <Alert
            severity="info"
            icon={false}
            variant="outlined"
            sx={{
              mb: 2,
              borderColor: ACCENT,
              color: NAVY,
              "& .MuiAlert-message": { fontSize: 14 }
            }}
          >
            Η δυνατότητα <strong>{focusMeta.label}</strong> δεν είναι ενεργοποιημένη στο πλάνο σας —
            ενεργοποίηση από <strong>{priceFor(focusMeta.monthlyPriceEUR)}€ {periodLabel}</strong>.
          </Alert>
        )}

        <Stack divider={<Box sx={{ height: 1, bgcolor: RULE }} />} spacing={0}>
          {allCodes.map((code) => {
            const meta = PREMIUM_FEATURE_CATALOGUE[code];
            const granted = premium.has(code);
            const focused = focusCode === code;
            return (
              <Box
                key={code}
                sx={{
                  py: 1.75,
                  px: focused ? 1.25 : 0,
                  borderLeft: focused ? `2px solid ${ACCENT}` : "2px solid transparent",
                  bgcolor: focused ? "rgba(30,167,225,0.03)" : "transparent"
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontWeight: 700, fontSize: 15, color: NAVY }}>
                        {meta.label}
                      </Typography>
                      {granted && (
                        <Chip
                          size="small"
                          icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                          label="Ενεργό"
                          sx={{
                            height: 22, fontSize: 11, fontWeight: 700,
                            bgcolor: "rgba(46,164,79,0.10)",
                            color: "#1e7a32",
                            "& .MuiChip-icon": { color: "#1e7a32" }
                          }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: 13, color: NAVY_SOFT, mt: 0.25, lineHeight: 1.5 }}>
                      {meta.description}
                    </Typography>
                  </Box>
                  {!granted && (
                    <Box sx={{ textAlign: "right", minWidth: 80, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: NAVY, lineHeight: 1 }}>
                        {priceFor(meta.monthlyPriceEUR)}€
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: NAVY_SOFT, mt: 0.25 }}>
                        {periodLabel}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={premium._closeDialog}
          sx={{ color: NAVY_SOFT, textTransform: "none", fontWeight: 600 }}
        >
          Κλείσιμο
        </Button>
        <Button
          component="a"
          href={mailto}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: NAVY,
            color: "#fff",
            textTransform: "none",
            fontWeight: 700,
            "&:hover": { bgcolor: NAVY_SOFT }
          }}
        >
          Επικοινωνία για αναβάθμιση
        </Button>
      </DialogActions>
    </Dialog>
  );
}
