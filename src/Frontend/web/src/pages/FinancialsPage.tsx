import { useMemo, useState } from "react";
import { Box, Card, Stack, Tab, Tabs, Typography } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useSearchParams } from "react-router-dom";
import { ReceiptsPage } from "./ReceiptsPage";
import { PaymentsPage } from "./PaymentsPage";
import { FinancialMovementsPage } from "./FinancialMovementsPage";
import { CashPositionPage } from "./CashPositionPage";
import { GeneralLedgerPage } from "./GeneralLedgerPage";

const TABS = [
  { key: "receipts", label: "Εισπράξεις", Component: ReceiptsPage },
  { key: "payments", label: "Πληρωμές", Component: PaymentsPage },
  { key: "movements", label: "Οικονομικές Κινήσεις", Component: FinancialMovementsPage },
  { key: "cash", label: "Ταμείο", Component: CashPositionPage },
  { key: "gl", label: "Λογιστική", Component: GeneralLedgerPage },
] as const;

/**
 * Unified financials workspace. The five separate pages (Receipts, Payments,
 * Movements, Cash, GL) share a customer/date focus and operators bounce
 * between them constantly. Rendering them as tabs on one page cuts the
 * sidebar noise and preserves scroll/filter state within a session.
 */
export function FinancialsPage() {
  const [search, setSearch] = useSearchParams();
  const initial = useMemo(() => {
    const t = search.get("tab");
    const idx = TABS.findIndex(x => x.key === t);
    return idx >= 0 ? idx : 0;
  }, [search]);
  const [tab, setTab] = useState(initial);

  const setActive = (v: number) => {
    setTab(v);
    const next = new URLSearchParams(search);
    next.set("tab", TABS[v].key);
    setSearch(next, { replace: true });
  };

  const Active = TABS[tab].Component;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <AccountBalanceIcon sx={{ fontSize: 36 }} color="primary" />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Οικονομικά</Typography>
          <Typography color="text.secondary">
            Εισπράξεις, πληρωμές, κινήσεις, ταμείο και λογιστική σε ένα workspace.
          </Typography>
        </Box>
      </Stack>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setActive(v)} variant="scrollable" sx={{ px: 1 }}>
          {TABS.map(t => <Tab key={t.key} label={t.label} />)}
        </Tabs>
      </Card>
      <Active />
    </Box>
  );
}
