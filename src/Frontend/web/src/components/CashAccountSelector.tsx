import { Alert, Box, Card, Chip, Stack, Typography } from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { SearchableSelect } from "./SearchableSelect";
import { money } from "../utils/format";

export interface CashAccountOption {
  id: string; code: string; name: string; currency: string; currentBalance: number; isActive: boolean;
}

export function CashAccountSelector({ accounts, value, onChange, loading = false }: {
  accounts: CashAccountOption[]; value: string; onChange: (value: string) => void; loading?: boolean;
}) {
  const selected = accounts.find(account => account.id === value);
  return <Card variant="outlined" data-cash-account-selector sx={{ p: 1.5, mb: 2, bgcolor: "background.default", minWidth: 0 }}>
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,2fr) minmax(0,1fr)" }, alignItems: "center" }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
        <AccountBalanceWalletOutlinedIcon color="primary" sx={{ fontSize: 30, flexShrink: 0 }} />
        <SearchableSelect label="Επιλογή ταμείου" value={value} onChange={onChange} disabled={loading}
          emptyLabel="Όλα τα ταμεία" placeholder="Αναζήτηση με όνομα ή κωδικό…"
          options={accounts.map(account => ({ value: account.id, label: `${account.code} · ${account.name}`,
            hint: `${money(account.currentBalance, account.currency)}${account.isActive ? "" : " · Ανενεργό"}` }))}
          sx={{ minWidth: 0 }} />
      </Stack>
      <Box aria-live="polite" sx={{ minWidth: 0, px: 1.5, py: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.paper" }}>
        {selected ? <>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="caption" color="text.secondary">Υπόλοιπο επιλεγμένου ταμείου</Typography>
            <Chip size="small" color={selected.isActive ? "success" : "default"} label={selected.isActive ? "Ενεργό" : "Ανενεργό"} /></Stack>
          <Typography fontWeight={800} fontSize={21} color={selected.currentBalance >= 0 ? "success.dark" : "error.main"}>{money(selected.currentBalance, selected.currency)}</Typography>
        </> : <><Typography fontWeight={700}>Όλα τα ταμεία · {accounts.length}</Typography><Typography variant="caption" color="text.secondary">Ενοποιημένη λίστα κινήσεων. Επιλέξτε ταμείο για το δικό του υπόλοιπο.</Typography></>}
      </Box>
    </Box>
    {!loading && accounts.length === 0 && <Alert severity="info" sx={{ mt: 1 }}>Δεν υπάρχουν ταμεία. Προσθέστε ένα από το κουμπί «Νέο ταμείο».</Alert>}
  </Card>;
}
