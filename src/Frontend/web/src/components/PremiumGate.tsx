import { Box, Button, Card, Stack, Typography } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { usePremium, PREMIUM_FEATURE_CATALOGUE, type PremiumFeatureCode } from "../auth/PremiumContext";

/**
 * Route-level gate for premium features. If the tenant has the code unlocked,
 * renders children. Otherwise renders an in-place "locked" panel with the same
 * gold styling as the crown badge + a button that opens the upgrade dialog.
 *
 * Backend protection is independent (RecycleBinController.EnsurePremiumAsync etc.)
 * — this is purely the UX side.
 */
export function PremiumGate({
  code,
  children
}: { code: PremiumFeatureCode; children: React.ReactNode }) {
  const premium = usePremium();
  if (premium.loading) return null;
  if (premium.has(code)) return <>{children}</>;
  const meta = PREMIUM_FEATURE_CATALOGUE[code];
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: { xs: 6, md: 10 } }}>
      <Card variant="outlined" sx={{
        maxWidth: 560, width: "100%", p: { xs: 3, md: 4 },
        borderColor: "rgba(176,138,62,0.45)",
        borderWidth: 1.5,
        background: "linear-gradient(180deg, #fff 0%, rgba(245,210,124,0.06) 100%)"
      }}>
        <Stack spacing={2.5} alignItems="center" sx={{ textAlign: "center" }}>
          <Box sx={{
            width: 80, height: 80, borderRadius: "50%",
            display: "grid", placeItems: "center",
            background: "linear-gradient(135deg, #f5d27c 0%, #b08a3e 100%)",
            color: "#3a2a05",
            boxShadow: "0 6px 18px rgba(176,138,62,0.35)"
          }}>
            <WorkspacePremiumIcon sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 850, color: "#0b2545" }}>
            {meta.label}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
            {meta.description}
          </Typography>
          <Box sx={{ pt: 1 }}>
            <Typography variant="caption" color="text.secondary">από</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 900, color: "#7a5b1c", lineHeight: 1 }}>
              {meta.monthlyPriceEUR}€<Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary" }}> / μήνα</Typography>
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<WorkspacePremiumIcon />}
            onClick={() => premium.promptUpgrade(code)}
            sx={{
              background: "linear-gradient(135deg, #b08a3e 0%, #7a5b1c 100%)",
              fontWeight: 800,
              "&:hover": { background: "linear-gradient(135deg, #c79a4a 0%, #8a6b22 100%)" }
            }}
          >
            Αναβάθμιση πλάνου
          </Button>
        </Stack>
      </Card>
    </Box>
  );
}
