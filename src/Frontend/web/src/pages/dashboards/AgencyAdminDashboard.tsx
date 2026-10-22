import { Box, Button, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useWorkspace } from "../../auth/WorkspaceContext";
import { CustomerPaymentAlerts } from "../../components/CustomerPaymentAlerts";
import { AgencyAnalyticsPanel } from "../../components/AgencyAnalyticsPanel";

export function AgencyAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { exitToHub } = useWorkspace();
  return <Box>
    <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => { exitToHub(); navigate("/app"); }} sx={{ mb: 2, color: "text.secondary" }}>
      Επιστροφή στον αρχικό Πίνακα Ελέγχου
    </Button>
    <Stack sx={{ mb: 2 }}>
      <Typography variant="h4" fontWeight={800}>Πίνακας ελέγχου διαχειριστή</Typography>
      <Typography color="text.secondary">{user?.tenantName} — επισκόπηση γραφείου</Typography>
    </Stack>
    <CustomerPaymentAlerts />
    <AgencyAnalyticsPanel />
  </Box>;
}
