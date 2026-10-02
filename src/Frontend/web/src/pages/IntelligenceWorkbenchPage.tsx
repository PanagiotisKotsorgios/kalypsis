import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ChatIcon from "@mui/icons-material/Chat";
import HistoryIcon from "@mui/icons-material/History";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import TuneIcon from "@mui/icons-material/Tune";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { Automation, Workbench, totalRunTokens } from "./intelligenceWorkbenchTypes";

const workbenchPath = "/app/intelligence-workbench";

function SummaryCard({ title, value, description, icon, to }: { title: string; value: string; description: string; icon: React.ReactNode; to: string }) {
  return <Card sx={{ height: "100%" }}><CardContent>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <Box><Typography variant="overline" color="text.secondary">{title}</Typography><Typography variant="h4" fontWeight={800}>{value}</Typography></Box>
      <Box sx={{ color: "primary.main" }}>{icon}</Box>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ minHeight: 42, mt: 1 }}>{description}</Typography>
    <Button component={RouterLink} to={to} size="small" sx={{ mt: 1, px: 0 }}>Άνοιγμα</Button>
  </CardContent></Card>;
}

export function IntelligenceWorkbenchPage() {
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση AI Workbench…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση του AI Workbench. Ελέγξτε τα δικαιώματα και το office AI key.</Alert></Box>;
  const data = q.data!;
  const tokens = totalRunTokens(data.runs);
  const activeAutomations = data.automations.filter((automation: Automation) => automation.isActive).length;
  return <Box sx={{ maxWidth: 1250, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={3}>
      <Box><Stack direction="row" spacing={1} alignItems="center"><SmartToyIcon color="primary" /><Typography variant="h5" fontWeight={800}>AI Workbench</Typography></Stack><Typography color="text.secondary">Κεντρική εικόνα του AI γραφείου. Κάθε λειτουργία έχει πλέον τη δική της σελίδα.</Typography></Box>
      <Stack direction="row" spacing={1} flexWrap="wrap"><Chip label={`${tokens.toLocaleString("el-GR")} tokens`} color="primary" variant="outlined" /><Chip label={data.storeResults ? "Αποθήκευση αποτελεσμάτων ενεργή" : "Αποθήκευση αποτελεσμάτων ανενεργή"} color={data.storeResults ? "success" : "warning"} /></Stack>
    </Stack>
    {!data.storeResults && <Alert severity="info" sx={{ mb: 2 }}>Το ιστορικό κρατά μεταδεδομένα και χρήση tokens. Για αποθήκευση πλήρων prompts και απαντήσεων ενεργοποιήστε το «Αποθήκευση αποτελεσμάτων AI» στις ρυθμίσεις Νοημοσύνης.</Alert>}
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}><SummaryCard title="Prompt library" value={String(data.prompts.length)} description="Δημιουργία, επεξεργασία και εκτέλεση prompts σε office δεδομένα." icon={<AutoAwesomeIcon />} to={`${workbenchPath}/prompts`} /></Grid>
      <Grid item xs={12} sm={6} md={3}><SummaryCard title="Εκτελέσεις" value={String(data.runs.length)} description="Αποτελέσματα, επιτυχίες, αποτυχίες και κατανάλωση tokens." icon={<PlayCircleOutlineIcon />} to={`${workbenchPath}/history`} /></Grid>
      <Grid item xs={12} sm={6} md={3}><SummaryCard title="Συνομιλίες" value={String(data.conversations.length)} description="Συνομιλία με το AI με σύνδεση σε πελάτη ή συμβόλαιο." icon={<ChatIcon />} to={`${workbenchPath}/chat`} /></Grid>
      <Grid item xs={12} sm={6} md={3}><SummaryCard title="Αυτοματισμοί" value={`${activeAutomations}/${data.automations.length}`} description="Ενεργές ροές και ενέργειες του γραφείου." icon={<TuneIcon />} to={`${workbenchPath}/automations`} /></Grid>
      <Grid item xs={12} md={7}><Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="h6">Πρόσφατες εκτελέσεις</Typography><Button component={RouterLink} to={`${workbenchPath}/history`} startIcon={<HistoryIcon />}>Όλο το ιστορικό</Button></Stack>{data.runs.length === 0 ? <Typography color="text.secondary">Δεν υπάρχουν εκτελέσεις ακόμη. Δημιουργήστε ένα prompt για να ξεκινήσετε.</Typography> : data.runs.slice(0, 5).map(run => <Stack key={run.id} direction="row" justifyContent="space-between" gap={1} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}><Box><Typography fontWeight={700}>{run.promptSummary || run.task}</Typography><Typography variant="caption" color="text.secondary">{new Date(run.createdAt).toLocaleString("el-GR")} · {run.promptTokens + run.completionTokens} tokens</Typography></Box><Chip size="small" label={run.success ? "Ολοκληρώθηκε" : "Αποτυχία"} color={run.success ? "success" : "error"} /></Stack>)}</CardContent></Card></Grid>
      <Grid item xs={12} md={5}><Card><CardContent><Typography variant="h6" mb={1}>Γρήγορες ενέργειες</Typography><Stack spacing={1}><Button component={RouterLink} to={`${workbenchPath}/prompts`} variant="contained" startIcon={<AutoAwesomeIcon />}>Νέο prompt</Button><Button component={RouterLink} to={`${workbenchPath}/chat`} variant="outlined" startIcon={<ChatIcon />}>Νέα συνομιλία</Button><Button component={RouterLink} to="/app/intelligence-settings" variant="outlined" startIcon={<TuneIcon />}>Ρυθμίσεις AI γραφείου</Button></Stack><Typography variant="caption" color="text.secondary" display="block" mt={2}>Όλες οι λειτουργίες παραμένουν περιορισμένες στα δεδομένα του τρέχοντος γραφείου.</Typography></CardContent></Card></Grid>
    </Grid>
  </Box>;
}
