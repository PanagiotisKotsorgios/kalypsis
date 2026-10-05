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
          bgcolor: "#fff3cd",
          color: "#7f1d1d",
          borderTop: "1px solid #f59e0b",
          borderBottom: "3px solid #c62828",
          "& .MuiAlert-icon": { color: "#c62828" },
          "& .MuiAlert-message": { width: "100%" },
          px: { xs: 1.5, sm: 3 },
          py: 0.9,
        }}
      >
        <Typography component="span" sx={{ fontWeight: 900, mr: 0.75 }}>
          Προσωρινή ενημέρωση:
        </Typography>
        <Typography component="span" sx={{ fontWeight: 600 }}>
          Η εξυπηρέτηση και η τεχνική υποστήριξη θα πραγματοποιούνται προσωρινά, λόγω τεχνικών αναβαθμίσεων στις υποδομές μας, από τις 15:30 έως τις 20:30.
        </Typography>
      </Alert>
    </Box>
  );
}
