import { useMemo } from "react";
import { Box, Tab, Tabs, Typography, Stack } from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import PaymentsIcon from "@mui/icons-material/Payments";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useSearchParams } from "react-router-dom";
import { SubscriptionPlansPage } from "./PlatformAdminPages";
import { PlatformBillingConfigPage } from "./PlatformBillingConfigPage";
import { PlatformInvoicesPage } from "./PlatformInvoicesPage";

/**
 * Merged finance surface — replaces the old 3-entry sidebar block
 * (/platform/plans, /platform/billing, /platform/invoices) with a
 * single tabbed page. Ops previously had to jump between three
 * near-identical page shells for what is really one workflow.
 *
 * The old URLs still work: the top-level Router redirects each to
 * /platform/finance?tab=<name>, and this page reads the `tab` query
 * param to open the right pane. Direct navigation via
 * /platform/finance defaults to «Πλάνα».
 */
export function PlatformFinancePage() {
  const [params, setParams] = useSearchParams();
  const active = useMemo(() => {
    const t = params.get("tab");
    if (t === "billing" || t === "invoices" || t === "plans") return t;
    return "plans" as const;
  }, [params]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <PaymentsIcon color="primary" sx={{ fontSize: 36 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>Πλάνα, Χρέωση & Τιμολόγια</Typography>
          <Typography variant="body2" color="text.secondary">
            Ενοποιημένη διαχείριση συνδρομητικών πλάνων, ρυθμίσεων χρέωσης και εκδιδόμενων τιμολογίων.
          </Typography>
        </Box>
      </Stack>
      <Tabs value={active} onChange={(_, v) => setParams(prev => {
        const n = new URLSearchParams(prev);
        n.set("tab", v);
        return n;
      })} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tab value="plans"    icon={<CreditCardIcon fontSize="small" />}    iconPosition="start" label="Συνδρομητικά πλάνα" />
        <Tab value="billing"  icon={<PaymentsIcon fontSize="small" />}      iconPosition="start" label="Ρυθμίσεις χρέωσης" />
        <Tab value="invoices" icon={<ReceiptLongIcon fontSize="small" />}   iconPosition="start" label="Τιμολόγια" />
      </Tabs>
      {active === "plans" && <SubscriptionPlansPage />}
      {active === "billing" && <PlatformBillingConfigPage />}
      {active === "invoices" && <PlatformInvoicesPage />}
    </Box>
  );
}
