import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";

interface CustomerPaymentAlertRow {
  customerId: string;
  customerName: string;
  balance: number;
  overdueAmount: number;
  overdueCount: number;
  paymentDueDate?: string | null;
  isPaymentOverdue?: boolean;
}

/**
 * Live dashboard alert for customer balances that passed their configured
 * settlement date (or an installment due date). It intentionally reads the
 * same account endpoint as the customer list, so receipts clear the alert
 * without a second status table or manual acknowledgement.
 */
export function CustomerPaymentAlerts() {
  const q = useQuery({
    queryKey: ["dashboard-customer-payment-overdue"],
    queryFn: async () => (await api.get<CustomerPaymentAlertRow[]>("/customers/accounts", {
      params: { onlyOverdue: true }
    })).data,
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000
  });

  const rows = (q.data ?? []).filter(r => r.overdueAmount > 0.005).slice(0, 8);
  if (q.isLoading || q.isError || rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.overdueAmount, 0);
  const money = (value: number) => value.toLocaleString("el-GR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <Card sx={{ mb: 3, border: "1px solid #ef9a9a", bgcolor: "#fff1f2", boxShadow: "0 8px 24px rgba(180,35,24,0.10)" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <WarningAmberIcon sx={{ color: "#b42318" }} />
          <Box>
            <Typography sx={{ fontWeight: 850, color: "#8f1d14" }}>
              Ληξιπρόθεσμες εξοφλήσεις πελατών
            </Typography>
            <Typography variant="body2" sx={{ color: "#8f1d14" }}>
              {rows.length} πελάτες · συνολικό ληξιπρόθεσμο υπόλοιπο {money(total)} €
            </Typography>
          </Box>
        </Stack>
        <Button component={RouterLink} to="/app/financials?tab=customerAccounts" size="small" color="error" endIcon={<ArrowForwardIcon />}>
          Όλα τα υπόλοιπα
        </Button>
      </Stack>
      <Divider sx={{ borderColor: "#f3b5b5" }} />
      <Stack divider={<Divider sx={{ borderColor: "#f3b5b5" }} />}>
        {rows.map(row => (
          <Stack key={row.customerId} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ px: 2, py: 1.25 }}>
            <Box>
              <Typography component={RouterLink} to={`/app/customers/${row.customerId}`} sx={{ color: "#7f1d1d", fontWeight: 750, textDecoration: "none" }}>
                {row.customerName}
              </Typography>
              <Typography variant="caption" sx={{ color: "#8f1d14", display: "block" }}>
                {row.paymentDueDate ? `Ημ. εξόφλησης: ${row.paymentDueDate}` : `${row.overdueCount} ληξιπρόθεσμες υποχρεώσεις`}
              </Typography>
            </Box>
            <Chip label={`Οφείλει ${money(row.overdueAmount)} €`} size="small" color="error" sx={{ fontWeight: 800, alignSelf: { xs: "flex-start", sm: "center" } }} />
          </Stack>
        ))}
      </Stack>
      {q.data && q.data.length > rows.length && (
        <Alert severity="error" icon={false} sx={{ borderRadius: 0, py: 0.5 }}>
          Εμφανίζονται οι πρώτες {rows.length} εγγραφές. Δείτε την πλήρη λίστα από το κουμπί παραπάνω.
        </Alert>
      )}
    </Card>
  );
}
