import { useMemo, useState } from "react";
import { Box, Button, Card, Stack, Tab, Tabs, Typography } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaymentIcon from "@mui/icons-material/Payment";
import PaidIcon from "@mui/icons-material/Paid";
import { useSearchParams } from "react-router-dom";
import { ReceiptsPage } from "./ReceiptsPage";
import { PaymentsPage } from "./PaymentsPage";
import { FinancialMovementsPage } from "./FinancialMovementsPage";
import { CashPositionPage } from "./CashPositionPage";
import { GeneralLedgerPage } from "./GeneralLedgerPage";
import { GeneralFinancialEntriesPage } from "./GeneralFinancialEntriesPage";

/**
 * Wrapper that folds the previously separate «Ταμείο», «Εισπράξεις»,
 * and «Πληρωμές» tabs into one workspace with an inline segmented
 * selector. The three panels share a customer/date focus and were
 * routinely opened in sequence — one tab with a fast sub-switch is
 * less noisy than three top-level tabs. Deep-link support preserved:
 * `?tab=cash|receipts|payments` lands directly on the matching sub-view.
 */
function CashReceiptsPaymentsPage() {
  const [search, setSearch] = useSearchParams();
  const sub = useMemo<"cash" | "receipts" | "payments">(() => {
    const t = search.get("tab");
    if (t === "receipts") return "receipts";
    if (t === "payments") return "payments";
    return "cash";
  }, [search]);
  const setSub = (v: "cash" | "receipts" | "payments") => {
    const next = new URLSearchParams(search);
    next.set("tab", v);
    setSearch(next, { replace: true });
  };
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <Button variant={sub === "cash" ? "contained" : "outlined"}
          startIcon={<AccountBalanceWalletIcon />}
          onClick={() => setSub("cash")}>Ταμείο</Button>
        <Button variant={sub === "receipts" ? "contained" : "outlined"}
          startIcon={<PaidIcon />}
          onClick={() => setSub("receipts")}>Εισπράξεις</Button>
        <Button variant={sub === "payments" ? "contained" : "outlined"}
          startIcon={<PaymentIcon />}
          onClick={() => setSub("payments")}>Πληρωμές</Button>
      </Stack>
      {sub === "cash" && <CashPositionPage />}
      {sub === "receipts" && <ReceiptsPage />}
      {sub === "payments" && <PaymentsPage />}
    </Box>
  );
}

// Cash + Εισπράξεις + Πληρωμές folded into one tab per user request —
// three panels share date/customer focus, kept together makes the tab
// bar less noisy. Deep-links `?tab=cash|receipts|payments` still work:
// the wrapper reads the tab param and lands on the matching sub-view.
const TABS = [
  { key: "cash", label: "Ταμείο / Εισπράξεις / Πληρωμές", Component: CashReceiptsPaymentsPage },
  { key: "movements", label: "Οικονομικές Κινήσεις", Component: FinancialMovementsPage },
  { key: "general", label: "Έσοδα / Έξοδα γραφείου", Component: GeneralFinancialEntriesPage },
  { key: "gl", label: "Λογιστική", Component: GeneralLedgerPage },
] as const;

// Every deep-link that could target one of the three merged sub-views
// resolves to the merged tab; the wrapper reads the SAME `?tab=` param
// again to pick the sub-view. Kept as a single Set so both the initial
// tab-index resolver AND any future callers use the same rule.
const MERGED_CASH_KEYS = new Set<string>(["cash", "receipts", "payments"]);

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
    if (t && MERGED_CASH_KEYS.has(t)) {
      // Any of the three merged deep-links lands on the merged tab.
      // The wrapper reads the SAME `?tab=` value to pick which sub-view
      // to show, so we don't rewrite the query here.
      return 0;
    }
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
