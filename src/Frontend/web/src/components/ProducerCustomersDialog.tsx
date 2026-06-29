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
import PeopleIcon from "@mui/icons-material/People";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { DataExportButton } from "./DataExportButton";

interface ProducerCustomerLine {
  customerId: string;
  customerNumber: string;
  customerDisplay: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  policyCount: number;
  totalPremium: number;
  currency: string;
  latestPolicyStart: string | null;
}

/**
 * Drawer-style dialog listing every customer that a given producer is the
 * producer-of-record for. Aggregates across policies so each customer shows up
 * once with totals. Plain search filters by name/number/email/phone/city.
 */
export function ProducerCustomersDialog({
  open,
  onClose,
  producerId,
  producerName
}: {
  open: boolean;
  onClose: () => void;
  producerId: string | null;
  producerName?: string;
}) {
  const [search, setSearch] = useState("");

  const q = useQuery({
    enabled: open && !!producerId,
    queryKey: ["producer-customers", producerId],
    queryFn: async () => (await api.get<ProducerCustomerLine[]>(`/producers/${producerId}/customers`)).data
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return all;
    return all.filter(r =>
      r.customerNumber.toLowerCase().includes(s) ||
      r.customerDisplay.toLowerCase().includes(s) ||
      (r.email ?? "").toLowerCase().includes(s) ||
      (r.phone ?? "").toLowerCase().includes(s) ||
      (r.city ?? "").toLowerCase().includes(s));
  }, [q.data, search]);

  const totalPremium = rows.reduce((s, r) => s + r.totalPremium, 0);
  const totalPolicies = rows.reduce((s, r) => s + r.policyCount, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, height: "85vh" } } }}>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            width: 42, height: 42, borderRadius: 2,
            display: "grid", placeItems: "center",
            bgcolor: "rgba(11,37,69,0.06)", color: "primary.main"
          }}>
            <PeopleIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 850, fontSize: 20 }}>
              Πελάτες συνεργάτη {producerName ? `· ${producerName}` : ""}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
              Πελάτες που έχουν συμβόλαια μέσω αυτού του συνεργάτη.
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            placeholder="Αναζήτηση σε όνομα, ΑΦΜ, email, τηλέφωνο, πόλη…"
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            }}
          />
          <Stack direction="row" spacing={1}>
            <Chip color="primary" variant="outlined" label={`${rows.length} πελάτες`} sx={{ fontWeight: 700 }} />
            <Chip variant="outlined" label={`${totalPolicies} συμβόλαια`} sx={{ fontWeight: 700 }} />
            <Chip variant="outlined" label={`${totalPremium.toFixed(2)} €`} sx={{ fontWeight: 700 }} />
          </Stack>
          {producerId && <DataExportButton entity="customers" search={search} />}
        </Stack>

        {q.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
        ) : q.isError ? (
          <Alert severity="error">Αδυναμία φόρτωσης πελατών για τον συνεργάτη.</Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
            <PeopleIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography>Δεν βρέθηκαν πελάτες με αυτά τα κριτήρια.</Typography>
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Α/Α</TableCell>
                <TableCell>Πελάτης</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Τηλέφωνο</TableCell>
                <TableCell>Πόλη</TableCell>
                <TableCell align="right">Συμβ.</TableCell>
                <TableCell align="right">Ασφάλιστρο</TableCell>
                <TableCell>Τελευταίο</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.customerId} hover>
                  <TableCell><Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.customerNumber}</Typography></TableCell>
                  <TableCell><Typography fontWeight={700}>{r.customerDisplay}</Typography></TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.email ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.phone ?? "—"}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.city ?? "—"}</TableCell>
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
