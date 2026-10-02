import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryIcon from "@mui/icons-material/History";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { Run, Workbench, totalRunTokens } from "./intelligenceWorkbenchTypes";

export function IntelligenceHistoryPage() {
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  const [status, setStatus] = useState("all"); const [search, setSearch] = useState("");
  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση ιστορικού AI…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση του ιστορικού AI.</Alert></Box>;
  const data = q.data!;
  const runs = data.runs.filter(run => (status === "all" || (status === "success" ? run.success : !run.success)) && (!search.trim() || `${run.promptSummary || ""} ${run.task} ${run.model}`.toLowerCase().includes(search.trim().toLowerCase())));
  const tokens = totalRunTokens(data.runs);
  return <Box sx={{ maxWidth: 1150, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>AI Workbench</Button>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={2}><Box><Stack direction="row" spacing={1} alignItems="center"><HistoryIcon color="primary" /><Typography variant="h5" fontWeight={800}>Ιστορικό εκτελέσεων</Typography></Stack><Typography color="text.secondary">Όλες οι εκτελέσεις prompts του γραφείου, με αποτέλεσμα, κατάσταση και κατανάλωση tokens.</Typography></Box><Chip label={`${tokens.toLocaleString("el-GR")} tokens συνολικά`} color="primary" variant="outlined" /></Stack>
    <Card sx={{ mb: 2 }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Αναζήτηση" value={search} onChange={e => setSearch(e.target.value)} fullWidth /><TextField select label="Κατάσταση" value={status} onChange={e => setStatus(e.target.value)} sx={{ minWidth: 180 }}><MenuItem value="all">Όλα</MenuItem><MenuItem value="success">Ολοκληρώθηκαν</MenuItem><MenuItem value="failed">Απέτυχαν</MenuItem></TextField></Stack></CardContent></Card>
    <Card><CardContent><Typography variant="h6" mb={1}>{runs.length} αποτελέσματα</Typography>{runs.length === 0 && <Typography color="text.secondary">Δεν βρέθηκαν εκτελέσεις με αυτά τα φίλτρα.</Typography>}{runs.map((run: Run) => <Box key={run.id}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1} sx={{ py: 1.5 }}><Box><Typography fontWeight={700}>{run.promptSummary || run.task} · {run.model}</Typography><Typography variant="caption" color="text.secondary">{new Date(run.createdAt).toLocaleString("el-GR")} · {run.promptTokens + run.completionTokens} tokens</Typography>{run.error && <Typography variant="body2" color="error.main" sx={{ mt: .5 }}>{run.error}</Typography>}{run.result && <Typography variant="body2" sx={{ mt: .75, whiteSpace: "pre-wrap" }}>{run.result}</Typography>}</Box><Chip label={run.success ? "Ολοκληρώθηκε" : "Αποτυχία"} color={run.success ? "success" : "error"} size="small" /></Stack><Divider /></Box>)}</CardContent></Card>
  </Box>;
}
