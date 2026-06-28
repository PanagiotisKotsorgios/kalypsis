import { Box, Tooltip } from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";

/**
 * Small gold crown badge to mark premium-only features in the sidebar / cards.
 * Pure visual hint — the actual gating happens in <PremiumGate /> and on the server.
 */
export function PremiumCrown({
  size = 16,
  tooltip = "Premium δυνατότητα — αναβαθμίστε το πλάνο σας"
}: { size?: number; tooltip?: string }) {
  return (
    <Tooltip title={tooltip} arrow>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size + 6,
          height: size + 6,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f5d27c 0%, #b08a3e 100%)",
          color: "#3a2a05",
          boxShadow: "0 1px 3px rgba(176,138,62,0.5)",
          ml: 0.5,
          flexShrink: 0
        }}
      >
        <WorkspacePremiumIcon sx={{ fontSize: size }} />
      </Box>
    </Tooltip>
  );
}
