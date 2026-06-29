import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import GroupsIcon from "@mui/icons-material/Groups";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface CustomerProducerLine {
  producerId: string;
  producerCode: string;
  producerName: string;
  policyCount: number;
  totalPremium: number;
  currency: string;
  latestPolicyStart: string | null;
}

/**
 * Reverse view of ProducerCustomersDialog — shows every producer that has
 * written policies for a specific customer. Useful when investigating
 * commission disputes or multi-producer customers.
 */
export function CustomerProducersDialog({
  open,
  onClose,
  customerId,
  customerDisplay
}: {
  open: boolean;
  onClose: () => void;
  customerId: string | null;
  customerDisplay?: string;
}) {
  const [search, setSearch] = useState("");

  const q = useQuery({
    enabled: open && !!customerId,
    queryKey: ["customer-producers", customerId],
    queryFn: async () => (await api.get<CustomerProducerLine[]>(`/customers/${customerId}/producers`)).data
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return all;
    return all.filter(r =>
      r.producerCode.toLowerCase().includes(s) ||
      r.producerName.toLowerCase().includes(s));
  }, [q.data, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 42, height: 42, borderRadius: 2,
            display: "grid", placeItems: "center",
            bgcolor: "rgba(11,37,69,0.06)", color: "primary.main"
          }}>
            <GroupsIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 850, fontSize: 20 }}>
              Συνεργάτες πελάτη {customerDisplay ? `· ${customerDisplay}` : ""}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Συνεργάτες που έχουν εκδώσει συμβόλαια για αυτόν τον πελάτη.
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {q.data && q.data.length > 6 && (
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            placeholder="Αναζήτηση σε κωδικό ή όνομα συνεργάτη…"
            fullWidth
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }}
          />
        )}

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
        ) : q.isError ? (
          <Alert severity="error">Αδυναμία φόρτωσης συνεργατών.</Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
            <GroupsIcon sx={{ fontSize: 44, opacity: 0.3, mb: 1 }} />
            <Typography>Δεν υπάρχουν συνεργάτες με συμβόλαια για αυτόν τον πελάτη.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Κωδικός</TableCell>
                <TableCell>Συνεργάτης</TableCell>
                <TableCell align="right">Συμβ.</TableCell>
                <TableCell align="right">Σύνολο</TableCell>
                <TableCell>Τελευταίο</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.producerId} hover>
                  <TableCell><Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.producerCode}</Typography></TableCell>
                  <TableCell><Typography fontWeight={700}>{r.producerName}</Typography></TableCell>
                  <TableCell align="right"><Chip size="small" label={r.policyCount} color="primary" variant="outlined" /></TableCell>
                  <TableCell align="right"><Typography fontWeight={700}>{r.totalPremium.toFixed(2)} {r.currency}</Typography></TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.latestPolicyStart ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
