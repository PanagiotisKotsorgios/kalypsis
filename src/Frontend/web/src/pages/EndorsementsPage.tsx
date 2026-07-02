import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CancelIcon from "@mui/icons-material/Cancel";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { HelpHint } from "../components/HelpHint";
import { money, date } from "../utils/format";
import { SearchableTextField } from "../components/SearchableTextField";

type EndorsementType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 99;
type EndorsementStatus = "Draft" | "Issued" | "Cancelled";

const TYPE_LABELS: Record<number, string> = {
  1: "Προσθήκη κάλυψης", 2: "Αφαίρεση κάλυψης", 3: "Αλλαγή στοιχείων",
  4: "Μερική ακύρωση", 5: "Αναπροσαρμογή ασφαλίστρου", 6: "Αλλαγή διεύθυνσης",
  7: "Αλλαγή δικαιούχου", 8: "Αλλαγή αντικειμένου", 9: "Επανέκδοση", 99: "Άλλο"
};

interface EndorsementDto {
  id: string; policyId: string; policyNumber: string;
  endorsementNumber: string; type: EndorsementType; status: EndorsementStatus;
  issuedAt: string; effectiveFrom: string; effectiveTo: string | null;
  description: string; carrierReference: string | null;
  premiumDelta: number; commissionDelta: number; currency: string;
  changesJson: string | null; notes: string | null; createdAt: string;
}

interface PolicyLite { id: string; policyNumber: string; premium: number; }

export function EndorsementsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EndorsementDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<EndorsementStatus | "all">("all");

  const q = useQuery({
    queryKey: ["endorsements", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      return (await api.get<EndorsementDto[]>("/endorsements", { params })).data;
    }
  });

  const issue = useMutation({
    mutationFn: async (id: string) => api.post(`/endorsements/${id}/issue`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["endorsements"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const cancel = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) =>
      api.post(`/endorsements/${vars.id}/cancel`, JSON.stringify(vars.reason), { headers: { "Content-Type": "application/json" }}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["endorsements"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <EditNoteIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>Πρόσθετες πράξεις</Typography>
              <HelpHint title="Πρόσθετη πράξη"
                body="Κάθε αλλαγή/επέκταση/μερική ακύρωση σε ένα υπάρχον συμβόλαιο. Διαμορφώνει το ασφάλιστρο και την προμήθεια όταν εκδοθεί." />
            </Stack>
            <Typography color="text.secondary">
              Διαχείριση πρόσθετων πράξεων σε υπάρχοντα συμβόλαια — προσθήκη/αφαίρεση κάλυψης, αλλαγή στοιχείων, αναπροσαρμογή.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέα πρόσθετη πράξη
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction="row" spacing={1} mb={2}>
        {(["all", "Draft", "Issued", "Cancelled"] as const).map(s => (
          <Chip key={s} label={s === "all" ? "Όλες" : s === "Draft" ? "Πρόχειρες" : s === "Issued" ? "Εκδοθείσες" : "Ακυρωμένες"}
            color={statusFilter === s ? "primary" : "default"}
            onClick={() => setStatusFilter(s)}
            variant={statusFilter === s ? "filled" : "outlined"}
            sx={{ cursor: "pointer" }} />
        ))}
      </Stack>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Αρ. πράξης</TableCell>
                <TableCell>Συμβόλαιο</TableCell>
                <TableCell>Τύπος</TableCell>
                <TableCell>Έκδοση / Ισχύς</TableCell>
                <TableCell align="right">Διαφορά ασφαλ.</TableCell>
                <TableCell align="right">Διαφορά προμ.</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν πρόσθετες πράξεις.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map(e => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{e.endorsementNumber}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{e.policyNumber}</TableCell>
                  <TableCell>{TYPE_LABELS[e.type]}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    <div>έκδοση: {date(e.issuedAt)}</div>
                    <div>ισχύς: {date(e.effectiveFrom)}</div>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: e.premiumDelta > 0 ? "error.main" : "success.main" }}>
                    {e.premiumDelta > 0 ? "+" : ""}{money(e.premiumDelta, e.currency)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>
                    {e.commissionDelta > 0 ? "+" : ""}{money(e.commissionDelta, e.currency)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={e.status === "Issued" ? "success" : e.status === "Cancelled" ? "default" : "warning"}
                      label={e.status === "Draft" ? "Πρόχειρη" : e.status === "Issued" ? "Εκδόθηκε" : "Ακυρώθηκε"} />
                  </TableCell>
                  <TableCell align="right">
                    {e.status === "Draft" && (
                      <>
                        <IconButton size="small" onClick={() => setEditing(e)} title="Επεξεργασία">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="success" onClick={() => issue.mutate(e.id)} title="Έκδοση">
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {e.status !== "Cancelled" && (
                      <IconButton size="small" color="error"
                        onClick={() => {
                          const r = prompt("Λόγος ακύρωσης πρόσθετης πράξης;");
                          if (r) cancel.mutate({ id: e.id, reason: r });
                        }} title="Ακύρωση">
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <EndorsementDialog
        open={createOpen || !!editing}
        item={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["endorsements"] });
          setCreateOpen(false); setEditing(null);
        }} />
    </Box>
  );
}

function EndorsementDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: EndorsementDto | null; onClose: () => void; onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [policy, setPolicy] = useState<PolicyLite | null>(null);
  const [form, setForm] = useState({
    type: 5 as EndorsementType,
    issuedAt: today, effectiveFrom: today, effectiveTo: "",
    description: "", carrierReference: "",
    premiumDelta: 0, commissionDelta: 0,
    changesJson: "", notes: ""
  });
  const [err, setErr] = useState<string | null>(null);

  const policies = useQuery({
    queryKey: ["policies-for-endorsement"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data,
    enabled: open && !item
  });

  useEffect(() => {
    if (item) {
      setForm({
        type: item.type,
        issuedAt: item.issuedAt, effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo ?? "",
        description: item.description,
        carrierReference: item.carrierReference ?? "",
        premiumDelta: item.premiumDelta, commissionDelta: item.commissionDelta,
        changesJson: item.changesJson ?? "", notes: item.notes ?? ""
      });
      setPolicy({ id: item.policyId, policyNumber: item.policyNumber, premium: 0 });
    } else if (open) {
      setForm({
        type: 5,
        issuedAt: today, effectiveFrom: today, effectiveTo: "",
        description: "", carrierReference: "",
        premiumDelta: 0, commissionDelta: 0,
        changesJson: "", notes: ""
      });
      setPolicy(null);
    }
  }, [item, open, today]);

  const save = useMutation({
    mutationFn: async () => {
      if (!policy && !item) throw new Error("Επιλέξτε συμβόλαιο.");
      const body = {
        policyId: item?.policyId ?? policy?.id,
        type: form.type,
        issuedAt: form.issuedAt,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        description: form.description.trim(),
        carrierReference: form.carrierReference || null,
        premiumDelta: Number(form.premiumDelta),
        commissionDelta: Number(form.commissionDelta),
        changesJson: form.changesJson || null,
        notes: form.notes || null
      };
      if (item) return (await api.put(`/endorsements/${item.id}`, body)).data;
      return (await api.post("/endorsements", body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {item ? `Επεξεργασία — ${item.endorsementNumber}` : "Νέα πρόσθετη πράξη"}
      </DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          {!item && (
            <Autocomplete
              options={policies.data ?? []}
              getOptionLabel={(p) => `${p.policyNumber} · ασφάλιστρο ${money(p.premium)}`}
              value={policy}
              onChange={(_, v) => setPolicy(v)}
              renderInput={(p) => <TextField {...p} label="Συμβόλαιο *" />}
              isOptionEqualToValue={(a, b) => a.id === b.id}
            />
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableTextField label="Τύπος πράξης" value={form.type}
              onChange={(e) => setForm({ ...form, type: Number(e.target.value) as EndorsementType })}
              sx={{ flex: 1 }} required>
              {Object.entries(TYPE_LABELS).map(([k, v]) =>
                <MenuItem key={k} value={Number(k)}>{v}</MenuItem>)}
            </SearchableTextField>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <HelpHint id="endorsement.type" />
            </Box>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="date" label="Ημ. έκδοσης" InputLabelProps={{ shrink: true }}
              value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} sx={{ flex: 1 }} />
            <TextField type="date" label="Ισχύς από" InputLabelProps={{ shrink: true }}
              value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} sx={{ flex: 1 }} />
            <TextField type="date" label="Ισχύς έως" InputLabelProps={{ shrink: true }}
              value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} sx={{ flex: 1 }} />
            <HelpHint id="endorsement.effectiveFrom" />
          </Stack>

          <TextField label="Περιγραφή" required value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline minRows={2} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Διαφορά ασφαλίστρου (€)" value={form.premiumDelta}
              onChange={(e) => setForm({ ...form, premiumDelta: Number(e.target.value) })}
              inputProps={{ step: "0.01" }} sx={{ flex: 1 }}
              helperText="Θετικό = επιπλέον χρέωση · Αρνητικό = επιστροφή" />
            <HelpHint id="endorsement.premiumDelta" />
            <TextField type="number" label="Διαφορά προμήθειας (€)" value={form.commissionDelta}
              onChange={(e) => setForm({ ...form, commissionDelta: Number(e.target.value) })}
              inputProps={{ step: "0.01" }} sx={{ flex: 1 }} />
          </Stack>

          <TextField label="Αναφορά ασφαλιστικής (προαιρετικό)" value={form.carrierReference}
            onChange={(e) => setForm({ ...form, carrierReference: e.target.value })} fullWidth />
          <TextField label="Σημειώσεις" value={form.notes} fullWidth multiline minRows={2}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || (!policy && !item) || !form.description.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
