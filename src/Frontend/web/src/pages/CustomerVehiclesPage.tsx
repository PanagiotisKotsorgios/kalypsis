import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, Chip, CircularProgress, InputAdornment, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface VehiclePolicyRow {
  id: string;
  customerId: string;
  customerDisplay?: string | null;
  policyNumber: string;
  insuranceCompanyName: string;
  policyType: string;
  status: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  vehicleRegistrationPlate?: string | null;
}

export function CustomerVehiclesPage() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["customer-vehicles-all"],
    queryFn: async () => (await api.get<VehiclePolicyRow[]>("/policies", { params: { type: "Auto" } })).data
  });
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    if (!term) return q.data ?? [];
    return (q.data ?? []).filter(row => [row.vehicleRegistrationPlate, row.customerDisplay, row.policyNumber, row.insuranceCompanyName].some(value => String(value ?? "").toLocaleLowerCase("el-GR").includes(term)));
  }, [q.data, search]);
  const uniquePlates = new Set(rows.map(row => row.vehicleRegistrationPlate).filter(Boolean)).size;
  const expiring = rows.filter(row => { const days = (new Date(row.endDate).getTime() - Date.now()) / 86400000; return days >= 0 && days <= 30; }).length;
  const exportCsv = () => {
    const header = ["Πινακίδα", "Πελάτης", "Αριθμός συμβολαίου", "Ασφαλιστική", "Έναρξη", "Λήξη", "Ασφάλιστρο", "Κατάσταση"];
    const body = rows.map(row => [row.vehicleRegistrationPlate ?? "", row.customerDisplay ?? "", row.policyNumber, row.insuranceCompanyName, row.startDate, row.endDate, String(row.premium ?? ""), row.status]);
    const csv = [header, ...body].map(line => line.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "οχηματα-πελατων.csv"; a.click(); URL.revokeObjectURL(url);
  };
  if (q.isLoading) return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (q.isError) return <Alert severity="error">{extractErrorMessage(q.error)}</Alert>;
  return <Stack spacing={2.5}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="h4" fontWeight={800}>Οχήματα πελατών</Typography><Typography color="text.secondary">Όλα τα οχήματα όπως προκύπτουν από τα ενεργά και ιστορικά συμβόλαια αυτοκινήτου.</Typography></Box>
      <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportCsv}>Εξαγωγή CSV</Button>
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Συμβόλαια αυτοκινήτου</Typography><Typography variant="h5" fontWeight={800}>{rows.length}</Typography></Card>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Μοναδικές πινακίδες</Typography><Typography variant="h5" fontWeight={800}>{uniquePlates}</Typography></Card>
      <Card variant="outlined" sx={{ p: 2, flex: 1 }}><Typography variant="caption" color="text.secondary">Λήγουν σε 30 ημέρες</Typography><Typography variant="h5" fontWeight={800} color={expiring ? "warning.main" : "text.primary"}>{expiring}</Typography></Card>
    </Stack>
    <TextField value={search} onChange={e => setSearch(e.target.value)} placeholder="Αναζήτηση πινακίδας, πελάτη, συμβολαίου ή ασφαλιστικής" InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
    {rows.length === 0 ? <Alert severity="info"><DirectionsCarIcon sx={{ verticalAlign: "middle", mr: 1 }} />Δεν βρέθηκαν οχήματα με τα συγκεκριμένα κριτήρια.</Alert> : <Card variant="outlined" sx={{ overflowX: "auto" }}><Table size="small">
      <TableHead><TableRow><TableCell>Πινακίδα</TableCell><TableCell>Πελάτης</TableCell><TableCell>Συμβόλαιο</TableCell><TableCell>Ασφαλιστική</TableCell><TableCell>Έναρξη</TableCell><TableCell>Λήξη</TableCell><TableCell align="right">Ασφάλιστρο</TableCell><TableCell>Κατάσταση</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(row => <TableRow key={row.id} hover>
        <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{row.vehicleRegistrationPlate ?? "—"}</TableCell>
        <TableCell><Button component={RouterLink} to={`/app/customers/${row.customerId}`} size="small">{row.customerDisplay ?? "Πελάτης"}</Button></TableCell>
        <TableCell><Button component={RouterLink} to={`/app/policies?focus=${row.id}`} size="small">{row.policyNumber}</Button></TableCell>
        <TableCell>{row.insuranceCompanyName}</TableCell><TableCell>{row.startDate}</TableCell><TableCell>{row.endDate}</TableCell>
        <TableCell align="right">{row.premium?.toLocaleString("el-GR", { minimumFractionDigits: 2 })} {row.currency}</TableCell><TableCell><Chip size="small" label={row.status} /></TableCell>
      </TableRow>)}</TableBody>
    </Table></Card>}
  </Stack>;
}
