import { useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

/** Notice shown on the dashboard home page. */
export function InfrastructureNoticeBanner({ home = false }: { home?: boolean }) {
  // Dismissal is intentionally session-only: a refresh shows the notice again.
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
  };

  return (
    <Box
      component="aside"
      role="status"
      aria-label="Ενημέρωση τεχνικής υποστήριξης"
      sx={home ? {
        position: "absolute",
        top: { xs: 0, sm: 1 },
        right: 0,
        zIndex: 2,
        width: { xs: "calc(100vw - 32px)", sm: 570, md: 700 },
        maxWidth: "100%",
      } : undefined}
    >
      <Alert
        severity="warning"
        icon={<WarningAmberIcon fontSize="inherit" />}
        onClose={dismiss}
        closeText="Κλείσιμο ενημέρωσης"
        sx={{
          borderRadius: 0,
          background: "#b71c1c",
          color: "#fff",
          borderTop: "4px solid #7f0000",
          borderBottom: "4px solid #7f0000",
          boxShadow: "0 2px 12px rgba(127, 0, 0, 0.32)",
          fontSize: home ? { xs: "0.95rem", sm: "1.08rem" } : { xs: "0.9rem", sm: "1rem" },
          "& .MuiAlert-icon": { color: "#fff" },
          "& .MuiAlert-action": { color: "#fff", alignItems: "center", pt: 0 },
          "& .MuiAlert-action .MuiIconButton-root": {
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.55)",
            borderRadius: "50%",
            p: 0.5,
            "&:hover": { bgcolor: "rgba(255,255,255,0.16)" },
          },
          "& .MuiAlert-message": { width: "100%", fontWeight: 700, lineHeight: 1.45 },
          px: home ? { xs: 1.75, sm: 2.5 } : { xs: 1.5, sm: 3 },
          py: home ? 1.35 : 1.1,
        }}
      >
        <Typography
          component="span"
          sx={{
            display: "inline-block",
            bgcolor: "#ffd600",
            color: "#3b1f00",
            borderRadius: 0.75,
            px: 1,
            py: 0.2,
            mr: 0.8,
            fontWeight: 900,
            fontSize: home ? { xs: "0.95rem", sm: "1.08rem" } : { xs: "0.9rem", sm: "1rem" },
            whiteSpace: "nowrap",
          }}
        >
          ΕΝΗΜΕΡΩΣΗ ΠΡΟΣ ΧΡΗΣΤΕΣ
        </Typography>
        <Typography component="span" sx={{ fontWeight: 600 }}>
          Η εξυπηρέτηση και η τεχνική υποστήριξη θα πραγματοποιούνται προσωρινά, λόγω τεχνικών αναβαθμίσεων στις υποδομές μας, από τις 15:30 έως τις 20:30. Ευχαριστούμε θερμά για την κατανόηση και την υπομονή σας.
        </Typography>
      </Alert>
    </Box>
  );
}
