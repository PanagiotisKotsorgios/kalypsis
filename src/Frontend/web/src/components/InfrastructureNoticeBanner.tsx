import { Alert, Box, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

/** Public notice shown consistently on every unauthenticated/pre-login page. */
export function InfrastructureNoticeBanner() {
  return (
    <Box component="aside" role="status" aria-label="Ενημέρωση τεχνικής υποστήριξης">
      <Alert
        severity="warning"
        icon={<WarningAmberIcon fontSize="inherit" />}
        sx={{
          borderRadius: 0,
          background: "linear-gradient(90deg, #fff4c2 0%, #ffe082 58%, #ffcdd2 100%)",
          color: "#7f1d1d",
          borderTop: "4px solid #d32f2f",
          borderBottom: "4px solid #b71c1c",
          boxShadow: "0 2px 10px rgba(183, 28, 28, 0.18)",
          fontSize: { xs: "0.9rem", sm: "1rem" },
          "& .MuiAlert-icon": { color: "#c62828" },
          "& .MuiAlert-message": { width: "100%", fontWeight: 700, lineHeight: 1.45 },
          px: { xs: 1.5, sm: 3 },
          py: 1.1,
        }}
      >
        <Typography
          component="span"
          sx={{
            display: "inline-block",
            bgcolor: "#b71c1c",
            color: "#fff",
            borderRadius: 0.75,
            px: 1,
            py: 0.2,
            mr: 0.8,
            fontWeight: 900,
            fontSize: { xs: "0.9rem", sm: "1rem" },
            whiteSpace: "nowrap",
          }}
        >
          Προσωρινή ενημέρωση:
        </Typography>
        <Typography component="span" sx={{ fontWeight: 600 }}>
          Η εξυπηρέτηση και η τεχνική υποστήριξη θα πραγματοποιούνται προσωρινά, λόγω τεχνικών αναβαθμίσεων στις υποδομές μας, από τις 15:30 έως τις 20:30. Ευχαριστούμε θερμά για την κατανόηση και την υπομονή σας.
        </Typography>
      </Alert>
    </Box>
  );
}
