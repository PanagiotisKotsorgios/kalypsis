import { useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

/** Public notice shown on unauthenticated/pre-login pages. */
export function InfrastructureNoticeBanner() {
  // Dismissal is intentionally session-only: a refresh shows the notice again.
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
  };

  return (
    <Box component="aside" role="status" aria-label="Ενημέρωση τεχνικής υποστήριξης">
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon fontSize="inherit" />}
        onClose={dismiss}
        closeText="Κλείσιμο ενημέρωσης"
        sx={{
          borderRadius: 0,
          background: "#E8F5ED",
          color: "#164B30",
          borderBottom: "1px solid #A7D5B8",
          boxShadow: "0 2px 10px rgba(16, 45, 85, 0.08)",
          fontSize: { xs: "0.9rem", sm: "1rem" },
          "& .MuiAlert-icon": { color: "#14864B" },
          "& .MuiAlert-action": { color: "#164B30", alignItems: "center", pt: 0 },
          "& .MuiAlert-action .MuiIconButton-root": {
            color: "#164B30",
            border: "1px solid #A7D5B8",
            borderRadius: "50%",
            p: 0.5,
            "&:hover": { bgcolor: "#D4EDDF" },
          },
          "& .MuiAlert-message": { width: "100%", fontWeight: 700, lineHeight: 1.45 },
          px: { xs: 1.5, sm: 3 },
          py: 1.1,
        }}
      >
        <Typography
          component="span"
          sx={{
            display: "inline-block",
            bgcolor: "#FFE16A",
            color: "#151515",
            borderRadius: 0.75,
            px: 1,
            py: 0.2,
            mr: 0.8,
            fontWeight: 900,
            fontSize: { xs: "0.9rem", sm: "1rem" },
            whiteSpace: "nowrap",
          }}
        >
          ΕΝΗΜΕΡΩΣΗ ΠΡΟΣ ΧΡΗΣΤΕΣ
        </Typography>
        <Typography component="span" sx={{ fontWeight: 600 }}>
          Η εξυπηρέτηση και η τεχνική υποστήριξη θα επανέλθουν στο κανονικό μας ωράριο στις 26/10/2026. Σας ευχαριστούμε θερμά για την κατανόηση και την υπομονή σας.
        </Typography>
      </Alert>
    </Box>
  );
}
