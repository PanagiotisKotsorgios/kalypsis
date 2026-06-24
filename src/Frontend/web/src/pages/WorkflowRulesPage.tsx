import { useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import BoltIcon from "@mui/icons-material/Bolt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

type WorkflowEvent =
  | "CustomerCreated" | "PolicyIssued" | "PolicyAboutToExpire" | "PolicyExpired"
  | "PolicyCancelled" | "InstallmentDue" | "InstallmentOverdue" | "ClaimReported"
  | "PaymentReceived" | "RequestSubmitted" | "RequestResolved" | "ConsentRevoked";

type WorkflowAction =
  | "SendEmail" | "SendSms" | "CreateTask" | "CreateNotification" | "CreateRequest"
  | "AssignAdvisor" | "TagCustomer" | "ChangePolicyStatus" | "Webhook";

const EVENTS: { code: WorkflowEvent; el: string }[] = [
  { code: "CustomerCreated",     el: "Δημιουργία πελάτη" },
  { code: "PolicyIssued",        el: "Έκδοση συμβολαίου" },
  { code: "PolicyAboutToExpire", el: "Συμβόλαιο κοντά στη λήξη" },
  { code: "PolicyExpired",       el: "Συμβόλαιο έληξε" },
  { code: "PolicyCancelled",     el: "Συμβόλαιο ακυρώθηκε" },
  { code: "InstallmentDue",      el: "Δόση προς εξόφληση" },
  { code: "InstallmentOverdue",  el: "Δόση καθυστερημένη" },
  { code: "ClaimReported",       el: "Αναγγελία ζημιάς" },
  { code: "PaymentReceived",     el: "Είσπραξη πληρωμής" },
  { code: "RequestSubmitted",    el: "Υποβολή αιτήματος" },
  { code: "RequestResolved",     el: "Επίλυση αιτήματος" },
  { code: "ConsentRevoked",      el: "Ανάκληση συναίνεσης" }
];

const ACTIONS: { code: WorkflowAction; el: string }[] = [
  { code: "SendEmail",          el: "Αποστολή email" },
  { code: "SendSms",            el: "Αποστολή SMS" },
  { code: "CreateTask",         el: "Δημιουργία εργασίας" },
  { code: "CreateNotification", el: "Ειδοποίηση εντός εφαρμογής" },
  { code: "CreateRequest",      el: "Δημιουργία αιτήματος" },
  { code: "AssignAdvisor",      el: "Ανάθεση σε σύμβουλο" },
  { code: "TagCustomer",        el: "Ετικέτα πελάτη" },
  { code: "ChangePolicyStatus", el: "Αλλαγή κατάστασης συμβολαίου" },
  { code: "Webhook",            el: "Κλήση webhook" }
];

interface RuleActionDto { id: string; action: WorkflowAction; order: number; payloadJson: string; }
interface RuleDto {
  id: string; name: string; triggerEvent: WorkflowEvent; isActive: boolean; priority: number;
  conditionsJson: string | null; actions: RuleActionDto[];
}

export function WorkflowRulesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["workflow-rules"],
    queryFn: async () => (await api.get<RuleDto[]>("/workflows")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["workflow-rules"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BoltIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Κανόνες αυτοματισμού</Typography>
            <Typography color="text.secondary">
              Δηλώστε γεγονότα και αυτόματες ενέργειες — emails, SMS, ειδοποιήσεις, αναθέσεις.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Νέος κανόνας
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Όνομα</TableCell>
                <TableCell>Γεγονός</TableCell>
                <TableCell>Ενέργειες</TableCell>
                <TableCell align="right">Προτεραιότητα</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν κανόνες ακόμη. Δημιουργήστε τον πρώτο σας με το κουμπί επάνω δεξιά.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={600}>{r.name}</Typography></TableCell>
                  <TableCell>
                    <Chip size="small" label={EVENTS.find((e) => e.code === r.triggerEvent)?.el ?? r.triggerEvent} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {r.actions.map((a) => (
                        <Chip key={a.id} size="small" variant="outlined"
                          label={ACTIONS.find((x) => x.code === a.action)?.el ?? a.action} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{r.priority}</TableCell>
                  <TableCell>
                    <Chip size="small" color={r.isActive ? "success" : "default"}
                      label={r.isActive ? "Ενεργός" : "Ανενεργός"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => {
                      if (confirm("Διαγραφή κανόνα;")) del.mutate(r.id);
                    }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <RuleDialog open={open} onClose={() => setOpen(false)} onSaved={() => {
        void qc.invalidateQueries({ queryKey: ["workflow-rules"] });
        setOpen(false);
      }} />
    </Box>
  );
}

function RuleDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<WorkflowEvent>("PolicyAboutToExpire");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(10);
  const [conditionsJson, setConditionsJson] = useState<string>("");
  const [actions, setActions] = useState<{ action: WorkflowAction; payloadJson: string }[]>([
    { action: "SendEmail", payloadJson: '{"subject":"Ανανέωση συμβολαίου","template":"renewal_30d"}' }
  ]);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        triggerEvent,
        isActive,
        priority: Number(priority),
        conditionsJson: conditionsJson.trim() || null,
        actions: actions.map((a, i) => ({ action: a.action, order: i, payloadJson: a.payloadJson }))
      };
      return (await api.post("/workflows", body)).data;
    },
    onSuccess: () => {
      setName(""); setConditionsJson(""); setActions([{ action: "SendEmail", payloadJson: "{}" }]);
      onSaved();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>Νέος κανόνας αυτοματισμού</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField label="Όνομα κανόνα" required fullWidth value={name}
            onChange={(e) => setName(e.target.value)} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select fullWidth label="Γεγονός" value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value as WorkflowEvent)}>
              {EVENTS.map((e) => <MenuItem key={e.code} value={e.code}>{e.el}</MenuItem>)}
            </TextField>
            <TextField type="number" fullWidth label="Προτεραιότητα" value={priority}
              onChange={(e) => setPriority(Number(e.target.value))} />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <Typography>{isActive ? "Ενεργός" : "Ανενεργός"}</Typography>
            </Stack>
          </Stack>

          <TextField
            label="Συνθήκες (JSON)"
            placeholder='{"daysUntilExpiry": 30}'
            multiline minRows={3} fullWidth
            value={conditionsJson}
            onChange={(e) => setConditionsJson(e.target.value)}
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Ενέργειες</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setActions([...actions, { action: "CreateNotification", payloadJson: "{}" }])}>
                Προσθήκη ενέργειας
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {actions.map((a, i) => (
                <Card key={i} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                    <TextField select size="small" label="Τύπος" value={a.action} sx={{ minWidth: 240 }}
                      onChange={(e) => {
                        const next = [...actions]; next[i] = { ...next[i], action: e.target.value as WorkflowAction };
                        setActions(next);
                      }}>
                      {ACTIONS.map((x) => <MenuItem key={x.code} value={x.code}>{x.el}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Παράμετροι (JSON)"
                      value={a.payloadJson} multiline minRows={2}
                      onChange={(e) => {
                        const next = [...actions]; next[i] = { ...next[i], payloadJson: e.target.value };
                        setActions(next);
                      }}
                      InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }} />
                    <IconButton size="small" color="error"
                      onClick={() => setActions(actions.filter((_, x) => x !== i))}
                      disabled={actions.length === 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" onClick={() => save.mutate()}
          disabled={save.isPending || !name.trim() || actions.length === 0}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
