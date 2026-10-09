import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, IconButton, InputLabel, MenuItem, Select,
  Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";

type AutomationAction = { action: number; order: number; payloadJson: string };
type AutomationRule = {
  id: string;
  name: string;
  triggerEvent: number | string;
  isActive: boolean;
  priority: number;
  conditionsJson?: string | null;
  actions: AutomationAction[];
};

const triggerOptions = [
  [1, "Δημιουργία πελάτη"], [2, "Έκδοση συμβολαίου"], [3, "Πλησιάζει λήξη συμβολαίου"],
  [4, "Λήξη συμβολαίου"], [5, "Ακύρωση συμβολαίου"], [6, "Λήξη δόσης"], [7, "Καθυστέρηση δόσης"],
  [8, "Νέα ζημιά"], [9, "Είσπραξη πληρωμής"], [10, "Νέο αίτημα"], [11, "Επίλυση αιτήματος"],
  [12, "Ανάκληση συγκατάθεσης"], [13, "Γενέθλια πελάτη"], [14, "Ονομαστική εορτή"],
  [15, "Ανενεργός πελάτης"], [16, "Επέτειος συνεργασίας"],
] as const;
const actionOptions = [
  [1, "Αποστολή email"], [2, "Αποστολή SMS"], [3, "Δημιουργία εργασίας"], [4, "Ειδοποίηση"],
  [5, "Δημιουργία αιτήματος"], [6, "Ανάθεση υπευθύνου"], [7, "Ετικέτα πελάτη"],
  [8, "Αλλαγή κατάστασης συμβολαίου"], [9, "Webhook"],
] as const;

const enumValue = (value: number | string, options: readonly (readonly [number, string])[]) => {
  if (typeof value === "number") return value;
  const found = options.find(([, label]) => label.toLowerCase() === value.toLowerCase() || value.toLowerCase().includes(label.toLowerCase()));
  return found?.[0] ?? (Number(value) || 1);
};
const labelFor = (value: number | string, options: readonly (readonly [number, string])[]) => options.find(([code]) => code === enumValue(value, options))?.[1] ?? String(value);

export function IntelligenceAutomationsPage() {
  const qc = useQueryClient();
  const rulesQuery = useQuery({ queryKey: ["intelligence-automations"], queryFn: async () => (await api.get<AutomationRule[]>("/workflows")).data });
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [selected, setSelected] = useState<AutomationRule | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(1);
  const [priority, setPriority] = useState(100);
  const [conditions, setConditions] = useState("");
  const [actions, setActions] = useState<AutomationAction[]>([{ action: 1, order: 0, payloadJson: "" }]);
  const [search, setSearch] = useState("");

  const clearForm = () => {
    setSelected(null); setName(""); setTrigger(1); setPriority(100); setConditions("");
    setActions([{ action: 1, order: 0, payloadJson: "" }]);
  };
  const openNew = () => { clearForm(); setEditorOpen(true); };
  const openEdit = (rule: AutomationRule) => {
    setSelected(rule); setName(rule.name); setTrigger(enumValue(rule.triggerEvent, triggerOptions)); setPriority(rule.priority ?? 100);
    setConditions(rule.conditionsJson ?? ""); setActions(rule.actions?.length ? rule.actions.map((a, i) => ({ action: enumValue(a.action, actionOptions), order: i, payloadJson: a.payloadJson ?? "" })) : [{ action: 1, order: 0, payloadJson: "" }]);
    setEditorOpen(true);
  };
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), triggerEvent: trigger, isActive: true, priority, conditionsJson: conditions.trim() || null, actions: actions.map((item, index) => ({ ...item, order: index, payloadJson: item.payloadJson || "{}" })) };
      return selected ? api.put(`/workflows/${selected.id}`, body) : api.post("/workflows", body);
    },
    onSuccess: () => { setEditorOpen(false); clearForm(); void qc.invalidateQueries({ queryKey: ["intelligence-automations"] }); void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] }); },
  });
  const remove = useMutation({ mutationFn: async (rule: AutomationRule) => api.delete(`/workflows/${rule.id}`), onSuccess: () => { setDeleteTarget(null); setPreview(null); void qc.invalidateQueries({ queryKey: ["intelligence-automations"] }); void qc.invalidateQueries({ queryKey: ["intelligence-workbench"] }); } });

  const rules = rulesQuery.data ?? [];
  const filteredRules = useMemo(() => rules.filter(rule => !search.trim() || `${rule.name} ${labelFor(rule.triggerEvent, triggerOptions)}`.toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR"))), [rules, search]);
  if (rulesQuery.isLoading) return <Box p={3}><Typography>Φόρτωση αυτοματισμών νοημοσύνης…</Typography></Box>;
  if (rulesQuery.isError) return <Box p={3}><Alert severity="error">Δεν ήταν δυνατή η φόρτωση των αυτοματισμών. Ελέγξτε ότι το γραφείο έχει ενεργό CRM.</Alert></Box>;

  return <Box sx={{ maxWidth: 1150, mx: "auto", p: { xs: 1.5, md: 3 } }}>
    <Button component={RouterLink} to="/app/intelligence-workbench" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>Κέντρο Νοημοσύνης</Button>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mb={2}><Box><Stack direction="row" spacing={1} alignItems="center"><AutoModeIcon color="primary" /><Typography variant="h5" fontWeight={800}>Αυτοματισμοί νοημοσύνης</Typography></Stack><Typography color="text.secondary">Ορίστε τι θα γίνεται αυτόματα για το συγκεκριμένο γραφείο, με γεγονός, συνθήκες και μία ή περισσότερες ενέργειες.</Typography></Box><Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ minWidth: 205, whiteSpace: "nowrap" }}>Νέος αυτοματισμός</Button></Stack>
    <Card sx={{ mb: 2, border: "1px solid", borderColor: "divider" }}><CardContent><Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}><TextField size="small" label="Αναζήτηση αυτοματισμών" value={search} onChange={event => setSearch(event.target.value)} fullWidth /><Chip label={`${filteredRules.length} από ${rules.length}`} color="primary" variant="outlined" /></Stack></CardContent></Card>
    <Card><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="h6">Αυτοματισμοί γραφείου</Typography><Chip label={`${rules.filter(rule => rule.isActive).length} ενεργοί`} color="success" variant="outlined" /></Stack><Divider />{filteredRules.length === 0 ? <Typography color="text.secondary" sx={{ py: 3 }}>Δεν υπάρχουν αυτοματισμοί με αυτά τα φίλτρα.</Typography> : <Stack divider={<Divider flexItem />}>{filteredRules.map(rule => <Stack key={rule.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1} sx={{ py: 1.5 }}><Box sx={{ cursor: "pointer", minWidth: 0 }} onClick={() => setPreview(rule)}><Typography fontWeight={700}>{rule.name}</Typography><Typography variant="body2" color="text.secondary">{labelFor(rule.triggerEvent, triggerOptions)} · {rule.actions?.length ?? 0} ενέργειες · προτεραιότητα {rule.priority}</Typography></Box><Stack direction="row" alignItems="center" spacing={.5} sx={{ flexShrink: 0 }}><Chip size="small" label={rule.isActive ? "Ενεργός" : "Ανενεργός"} color={rule.isActive ? "success" : "default"} /><Tooltip title="Επεξεργασία"><IconButton size="small" color="success" onClick={() => openEdit(rule)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Διαγραφή"><IconButton size="small" color="error" onClick={() => setDeleteTarget(rule)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></Stack></Stack>)}</Stack>}</CardContent></Card>

    <Dialog open={editorOpen} onClose={() => { setEditorOpen(false); clearForm(); }} fullWidth maxWidth="md"><DialogTitle sx={{ pr: 6 }}>{selected ? "Επεξεργασία αυτοματισμού" : "Νέος αυτοματισμός γραφείου"}<IconButton onClick={() => { setEditorOpen(false); clearForm(); }} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton></DialogTitle><DialogContent dividers><Stack spacing={1.5}><TextField label="Όνομα αυτοματισμού" value={name} onChange={event => setName(event.target.value)} autoFocus fullWidth /><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><FormControl fullWidth><InputLabel>Γεγονός ενεργοποίησης</InputLabel><Select label="Γεγονός ενεργοποίησης" value={trigger} onChange={event => setTrigger(Number(event.target.value))}>{triggerOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField label="Προτεραιότητα" type="number" value={priority} onChange={event => setPriority(Math.max(0, Number(event.target.value) || 0))} sx={{ width: { xs: "100%", sm: 170 } }} /></Stack><TextField label="Συνθήκες (προαιρετικό JSON)" value={conditions} onChange={event => setConditions(event.target.value)} placeholder='π.χ. {"premiumMin":500}' helperText="Αφήστε το κενό για να εφαρμόζεται σε κάθε εγγραφή του γραφείου." multiline minRows={2} fullWidth /><Divider /><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="subtitle1" fontWeight={700}>Ενέργειες</Typography><Button size="small" startIcon={<AddIcon />} onClick={() => setActions(current => [...current, { action: 1, order: current.length, payloadJson: "" }])}>Προσθήκη ενέργειας</Button></Stack>{actions.map((item, index) => <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch"><FormControl fullWidth size="small"><InputLabel>Ενέργεια {index + 1}</InputLabel><Select label={`Ενέργεια ${index + 1}`} value={item.action} onChange={event => setActions(current => current.map((entry, i) => i === index ? { ...entry, action: Number(event.target.value) } : entry))}>{actionOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField size="small" label="Περιεχόμενο / παράμετροι" value={item.payloadJson} onChange={event => setActions(current => current.map((entry, i) => i === index ? { ...entry, payloadJson: event.target.value } : entry))} placeholder="π.χ. θέμα email ή κείμενο εργασίας" fullWidth />{actions.length > 1 && <IconButton color="error" onClick={() => setActions(current => current.filter((_, i) => i !== index))}><DeleteOutlineIcon /></IconButton>}</Stack>)}</Stack></DialogContent><DialogActions sx={{ px: 3, py: 2 }}><Button color="error" onClick={() => { setEditorOpen(false); clearForm(); }}>Ακύρωση</Button><Button variant="contained" startIcon={<AddIcon />} disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Αποθήκευση</Button></DialogActions></Dialog>
    <Dialog open={!!preview} onClose={() => setPreview(null)} fullWidth maxWidth="sm"><DialogTitle sx={{ pr: 6 }}>Προβολή αυτοματισμού{preview ? ` · ${preview.name}` : ""}<IconButton onClick={() => setPreview(null)} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton></DialogTitle><DialogContent dividers>{preview && <Stack spacing={1.25}><Chip label={preview.isActive ? "Ενεργός" : "Ανενεργός"} color={preview.isActive ? "success" : "default"} sx={{ alignSelf: "flex-start" }} /><Box><Typography variant="caption" color="text.secondary">Γεγονός</Typography><Typography>{labelFor(preview.triggerEvent, triggerOptions)}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Προτεραιότητα</Typography><Typography>{preview.priority}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Συνθήκες</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{preview.conditionsJson || "Χωρίς πρόσθετες συνθήκες"}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Ενέργειες</Typography>{preview.actions?.map((action, index) => <Typography key={index}>• {labelFor(action.action, actionOptions)}{action.payloadJson && action.payloadJson !== "{}" ? ` · ${action.payloadJson}` : ""}</Typography>)}</Box></Stack>}</DialogContent><DialogActions><Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => preview && setDeleteTarget(preview)}>Διαγραφή</Button><Button variant="contained" color="success" startIcon={<EditOutlinedIcon />} onClick={() => { if (preview) openEdit(preview); setPreview(null); }}>Επεξεργασία</Button><Button onClick={() => setPreview(null)}>Κλείσιμο</Button></DialogActions></Dialog>
    <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth><DialogTitle>Διαγραφή αυτοματισμού;</DialogTitle><DialogContent><Typography>Θέλετε να διαγραφεί ο «{deleteTarget?.name}»;</Typography></DialogContent><DialogActions><Button onClick={() => setDeleteTarget(null)}>Ακύρωση</Button><Button color="error" variant="contained" disabled={remove.isPending} onClick={() => deleteTarget && remove.mutate(deleteTarget)}>Διαγραφή</Button></DialogActions></Dialog>
  </Box>;
}
