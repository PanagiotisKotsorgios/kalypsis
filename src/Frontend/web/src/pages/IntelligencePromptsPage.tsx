import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { DEFAULT_PROMPT, Prompt, Workbench } from "./intelligenceWorkbenchTypes";

const scopeLabels: Record<string, string> = {
  General: "Γενικό",
  Customer: "Πελάτης",
  Policy: "Συμβόλαιο",
  Portfolio: "Χαρτοφυλάκιο",
};

export function IntelligencePromptsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["intelligence-workbench"], queryFn: async () => (await api.get<Workbench>("/intelligence/workbench")).data });
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [preview, setPreview] = useState<Prompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [template, setTemplate] = useState(DEFAULT_PROMPT);
  const [scope, setScope] = useState("Customer");
  const [customerId, setCustomerId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [override, setOverride] = useState("");
  const [result, setResult] = useState("");

  const clearForm = () => {
    setSelected(null);
    setName("");
    setPurpose("");
    setTemplate(DEFAULT_PROMPT);
    setScope("Customer");
    setResult("");
  };

  const fillForm = (prompt: Prompt | null) => {
    setSelected(prompt);
    setName(prompt?.name ?? "");
    setPurpose(prompt?.purpose ?? "");
    setTemplate(prompt?.template ?? DEFAULT_PROMPT);
    setScope(prompt?.contextScope ?? "Customer");
    setResult("");
  };

  const startNew = () => {
    clearForm();
    setEditorOpen(true);
  };

  const startEdit = (prompt: Prompt) => {
    fillForm(prompt);
    setEditorOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = { name, purpose, template, contextScope: scope, isActive: true };
      return selected
        ? (await api.put(`/intelligence/prompts/${selected.id}`, body)).data
        : (await api.post<Prompt>("/intelligence/prompts", body)).data;
    },
    onSuccess: () => {
      setEditorOpen(false);
      clearForm();
      void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (prompt: Prompt) => api.delete(`/intelligence/prompts/${prompt.id}`),
    onSuccess: (_, prompt) => {
      if (selected?.id === prompt.id) clearForm();
      setDeleteTarget(null);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] });
    },
  });

  const run = useMutation({
    mutationFn: async (prompt: Prompt) => (await api.post<{ text?: string; error?: string }>(`/intelligence/prompts/${prompt.id}/run`, { customerId: customerId || null, policyId: policyId || null, promptOverride: override || null })).data,
    onSuccess: x => {
      setResult(x.text || x.error || "Δεν επιστράφηκε αποτέλεσμα.");
      void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] });
    },
  });

  if (q.isLoading) return <Box p={3}><Typography>Φόρτωση βιβλιοθήκης προτύπων…</Typography></Box>;
  if (q.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση των προτύπων.</Alert></Box>;

  const data = q.data!;
  const filteredPrompts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("el-GR");
    return data.prompts.filter(prompt => {
      const matchesSearch = !term || `${prompt.name} ${prompt.purpose} ${prompt.template}`.toLocaleLowerCase("el-GR").includes(term);
      return matchesSearch && (scopeFilter === "all" || prompt.contextScope === scopeFilter);
    });
  }, [data.prompts, scopeFilter, search]);
  const activePrompt = selected ?? filteredPrompts[0] ?? data.prompts[0];

  return <Box sx={{ maxWidth: 1250, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={2}>
      <Box>
        <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>Κέντρο Νοημοσύνης</Button>
        <Stack direction="row" spacing={1} alignItems="center"><SmartToyIcon color="primary" /><Typography variant="h5" fontWeight={800}>Βιβλιοθήκη προτύπων</Typography></Stack>
        <Typography color="text.secondary">Τα πρότυπα του γραφείου σας, με πλαίσιο δεδομένων και εκτέλεση σε πελάτες ή συμβόλαια.</Typography>
      </Box>
      <Chip label={`${data.prompts.length} πρότυπα`} color="primary" variant="outlined" />
    </Stack>

    <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField size="small" label="Αναζήτηση προτύπων" value={search} onChange={event => setSearch(event.target.value)} placeholder="Όνομα, σκοπός ή οδηγίες" InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} sx={{ flex: 1, minWidth: 220 }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Πλαίσιο</InputLabel>
            <Select label="Πλαίσιο" value={scopeFilter} onChange={event => setScopeFilter(event.target.value)}>
              <MenuItem value="all">Όλα τα πλαίσια</MenuItem>
              {Object.entries(scopeLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startNew} sx={{ minWidth: 155, whiteSpace: "nowrap" }}>Νέο πρότυπο</Button>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.25}>
          <Typography variant="caption" color="text.secondary">Εμφανίζονται {filteredPrompts.length} από {data.prompts.length} πρότυπα</Typography>
          {(search || scopeFilter !== "all") && <Button size="small" onClick={() => { setSearch(""); setScopeFilter("all"); }}>Καθαρισμός φίλτρων</Button>}
        </Stack>
      </CardContent>
    </Card>

    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" mb={1}>Τα πρότυπα του γραφείου</Typography>
        <Divider sx={{ mb: 1 }} />
        {filteredPrompts.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>Δεν βρέθηκαν πρότυπα με αυτά τα φίλτρα.</Typography>}
        <Stack divider={<Divider flexItem />}>
          {filteredPrompts.map(prompt => <Stack key={prompt.id} direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1} sx={{ py: 1.25 }}>
            <Box sx={{ minWidth: 0, cursor: "pointer" }} onClick={() => { setPreview(prompt); setSelected(prompt); }}>
              <Typography fontWeight={700} noWrap>{prompt.name}</Typography>
              <Typography variant="caption" color="text.secondary">{scopeLabels[prompt.contextScope] ?? prompt.contextScope} · {prompt.purpose || "Χωρίς περιγραφή"}</Typography>
            </Box>
            <Stack direction="row" alignItems="center" spacing={.5} sx={{ flexShrink: 0 }}>
              <Chip size="small" label={prompt.isActive ? "Ενεργό" : "Ανενεργό"} color={prompt.isActive ? "success" : "default"} />
              <Tooltip title="Προβολή προτύπου"><IconButton size="small" color="info" onClick={() => { setPreview(prompt); setSelected(prompt); }}><VisibilityOutlinedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Επεξεργασία προτύπου"><IconButton size="small" color="success" onClick={() => startEdit(prompt)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Διαγραφή προτύπου"><IconButton size="small" color="error" onClick={() => setDeleteTarget(prompt)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
            </Stack>
          </Stack>)}
        </Stack>
      </CardContent>
    </Card>

    <Card>
      <CardContent>
        <Typography variant="h6" mb={1}>Εκτέλεση προτύπου</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>Οι αναγνωριστικοί αριθμοί είναι προαιρετικοί. Όταν δοθούν, το αποτέλεσμα χρησιμοποιεί μόνο τα δεδομένα του τρέχοντος γραφείου.</Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}><TextField label="Κωδικός πελάτη (προαιρετικό)" value={customerId} onChange={event => setCustomerId(event.target.value)} fullWidth /></Grid>
          <Grid item xs={12} md={4}><TextField label="Κωδικός συμβολαίου (προαιρετικό)" value={policyId} onChange={event => setPolicyId(event.target.value)} fullWidth /></Grid>
          <Grid item xs={12} md={4}><TextField label="Προσωρινή οδηγία" value={override} onChange={event => setOverride(event.target.value)} fullWidth /></Grid>
        </Grid>
        <Button sx={{ mt: 1.5 }} variant="contained" color="secondary" startIcon={<PlayArrowIcon />} disabled={!activePrompt || run.isPending} onClick={() => activePrompt && run.mutate(activePrompt)}>Εκτέλεση</Button>
        {activePrompt && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Επιλεγμένο: {activePrompt.name}</Typography>}
        {result && <Card variant="outlined" sx={{ mt: 2, bgcolor: "action.hover" }}><CardContent><Typography variant="subtitle2">Αποτέλεσμα</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{result}</Typography></CardContent></Card>}
      </CardContent>
    </Card>

    <Dialog open={editorOpen} onClose={() => { setEditorOpen(false); clearForm(); }} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>{selected ? "Επεξεργασία προτύπου" : "Νέο πρότυπο γραφείου"}<IconButton onClick={() => { setEditorOpen(false); clearForm(); }} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton></DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" mb={2}>Χρησιμοποιήστε το <code>{"{{context}}"}</code> για να εισαχθούν αυτόματα τα στοιχεία του επιλεγμένου πελάτη ή συμβολαίου.</Typography>
        <Stack spacing={1.5}>
          <TextField label="Όνομα" value={name} onChange={event => setName(event.target.value)} fullWidth autoFocus />
          <TextField label="Σκοπός" value={purpose} onChange={event => setPurpose(event.target.value)} fullWidth />
          <TextField select SelectProps={{ native: true }} label="Πλαίσιο" value={scope} onChange={event => setScope(event.target.value)}><option value="General">Γενικό</option><option value="Customer">Πελάτης</option><option value="Policy">Συμβόλαιο</option><option value="Portfolio">Χαρτοφυλάκιο</option></TextField>
          <TextField label="Πρότυπο / οδηγίες" value={template} onChange={event => setTemplate(event.target.value)} multiline minRows={8} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}><Button color="error" onClick={() => { setEditorOpen(false); clearForm(); }}>Ακύρωση</Button><Button variant="contained" startIcon={<AddIcon />} disabled={!name.trim() || !template.trim() || save.isPending} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions>
    </Dialog>

    <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>Προβολή προτύπου{preview ? ` · ${preview.name}` : ""}<IconButton onClick={() => setPreview(null)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton></DialogTitle>
      <DialogContent dividers>
        {preview && <Stack spacing={1.5}><Stack direction="row" gap={1} flexWrap="wrap"><Chip label={scopeLabels[preview.contextScope] ?? preview.contextScope} color="primary" variant="outlined" /><Chip label={preview.isActive ? "Ενεργό" : "Ανενεργό"} color={preview.isActive ? "success" : "default"} /></Stack><Box><Typography variant="caption" color="text.secondary">Σκοπός</Typography><Typography>{preview.purpose || "Δεν έχει οριστεί"}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Πρότυπο / οδηγίες</Typography><Box sx={{ mt: .5, p: 1.5, bgcolor: "action.hover", borderRadius: 1, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{preview.template}</Box></Box></Stack>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}><Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => preview && setDeleteTarget(preview)}>Διαγραφή</Button><Button color="success" variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => { if (preview) startEdit(preview); setPreview(null); }}>Επεξεργασία</Button><Button onClick={() => setPreview(null)}>Κλείσιμο</Button></DialogActions>
    </Dialog>

    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Διαγραφή προτύπου;</DialogTitle>
      <DialogContent><Typography>Θέλετε να διαγραφεί το «{deleteTarget?.name}»; Η ενέργεια δεν μπορεί να αναιρεθεί.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setDeleteTarget(null)}>Ακύρωση</Button><Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={remove.isPending} onClick={() => deleteTarget && remove.mutate(deleteTarget)}>Διαγραφή</Button></DialogActions>
    </Dialog>
  </Box>;
}
