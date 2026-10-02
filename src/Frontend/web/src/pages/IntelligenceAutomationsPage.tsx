import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { Automation, Workbench } from "./intelligenceWorkbenchTypes";

export function IntelligenceAutomationsPage() {
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση αυτοματισμών AI…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση των αυτοματισμών.</Alert></Box>;
  const automations = q.data!.automations;
  return <Box sx={{ maxWidth: 1050, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>AI Workbench</Button>
    <Stack direction="row" spacing={1} alignItems="center" mb={1}><AutoModeIcon color="primary" /><Typography variant="h5" fontWeight={800}>Αυτοματισμοί AI</Typography></Stack>
    <Typography color="text.secondary" mb={2}>Οι workflows του γραφείου που τροφοδοτούν ειδοποιήσεις, εργασίες, επικοινωνίες και αναλύσεις.</Typography>
    <Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="h6">Ροές γραφείου</Typography><Chip label={`${automations.filter((automation: Automation) => automation.isActive).length} ενεργές`} color="success" variant="outlined" /></Stack>{automations.length === 0 ? <Typography color="text.secondary">Δεν έχουν δημιουργηθεί workflows ακόμη.</Typography> : automations.map((automation: Automation) => <Stack key={automation.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}><Box><Typography fontWeight={700}>{automation.name}</Typography><Typography variant="body2" color="text.secondary">Έναυσμα: {automation.trigger} · {automation.actions} ενέργειες</Typography></Box><Chip size="small" label={automation.isActive ? "Ενεργό" : "Ανενεργό"} color={automation.isActive ? "success" : "default"} /></Stack>)}</CardContent></Card>
  </Box>;
}
