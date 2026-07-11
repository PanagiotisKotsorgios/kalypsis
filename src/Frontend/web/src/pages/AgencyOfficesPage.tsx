import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import StarIcon from "@mui/icons-material/Star";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface OfficeDto {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
  userCount: number;
  notes: string | null;
}

interface UpsertBody {
  code: string; name: string;
  city: string | null; address: string | null; postalCode: string | null;
  phone: string | null; email: string | null;
  isHeadquarters: boolean; isActive: boolean;
  notes: string | null;
}

export function AgencyOfficesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeDto | null>(null);

  const q = useQuery({
    queryKey: ["agency-offices"],
    queryFn: async () => (await api.get<OfficeDto[]>("/agency-offices")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/agency-offices/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agency-offices"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <HomeWorkIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Υποκαταστήματα</Typography>
            <Typography color="text.secondary">
              Όλα τα φυσικά γραφεία του πρακτορείου σε διαφορετικές πόλεις. Το κεντρικό
              περιλαμβάνεται στη βασική συνδρομή — για κάθε επιπλέον προστίθεται μηνιαία χρέωση.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέο υποκατάστημα
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
                <TableCell>Κωδικός</TableCell>
                <TableCell>Όνομα</TableCell>
                <TableCell>Πόλη</TableCell>
                <TableCell>Επικοινωνία</TableCell>
                <TableCell align="right">Χρήστες</TableCell>
                <TableCell>Κατάσταση</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} align="center" sx={{ color: "text.secondary", py: 4 }}>
                  Δεν υπάρχουν καταχωρημένα υποκαταστήματα. Δημιουργήστε πρώτο το κεντρικό.
                </TableCell></TableRow>
              )}
              {(q.data ?? []).map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={o.code} sx={{ fontFamily: "monospace" }} />
                      {o.isHeadquarters && (
                        <Chip size="small" icon={<StarIcon />} label="Κεντρικό" color="warning" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell><Typography fontWeight={600}>{o.name}</Typography></TableCell>
                  <TableCell>
                    {o.city ?? "—"}
                    {o.postalCode && <Typography variant="caption" color="text.secondary" display="block">{o.postalCode}</Typography>}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>
                    {o.phone && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <PhoneIcon fontSize="inherit" sx={{ color: "text.secondary" }} />
                        <span>{o.phone}</span>
                      </Box>
                    )}
                    {o.email && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "var(--ink-soft, #777)" }}>
                        <EmailIcon fontSize="inherit" />
                        <span>{o.email}</span>
                      </Box>
                    )}
                    {!o.phone && !o.email && "—"}
                  </TableCell>
                  <TableCell align="right">{o.userCount}</TableCell>
                  <TableCell>
                    <Chip size="small" color={o.isActive ? "success" : "default"}
                      label={o.isActive ? "Ενεργό" : "Ανενεργό"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(o)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!o.isHeadquarters && (
                      <IconButton size="small" color="error" onClick={() => {
                        if (confirm(`Διαγραφή υποκαταστήματος "${o.name}";`)) del.mutate(o.id);
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <OfficeDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setCreateOpen(false); }} />
      <OfficeDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["agency-offices"] }); setEditing(null); }} />
    </Box>
  );
}

function OfficeDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void; item: OfficeDto | null; onSaved: () => void;
}) {
  const editing = !!item;
  const [form, setForm] = useState<UpsertBody>({
    code: "", name: "", city: null, address: null, postalCode: null,
    phone: null, email: null, isHeadquarters: false, isActive: true, notes: null
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        code: item.code, name: item.name,
        city: item.city, address: item.address, postalCode: item.postalCode,
        phone: item.phone, email: item.email,
        isHeadquarters: item.isHeadquarters, isActive: item.isActive,
        notes: item.notes
      });
    } else if (open) {
      setForm({
        code: "", name: "", city: null, address: null, postalCode: null,
        phone: null, email: null, isHeadquarters: false, isActive: true, notes: null
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form,
        code: form.code.trim(), name: form.name.trim(),
        city: form.city?.trim() || null,
        address: form.address?.trim() || null,
        postalCode: form.postalCode?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null
      };
      if (editing && item) return (await api.put(`/agency-offices/${item.id}`, body)).data;
      return (await api.post("/agency-offices", body)).data;
    },
    onSuccess: () => {
      setForm({ code: "", name: "", city: null, address: null, postalCode: null,
        phone: null, email: null, isHeadquarters: false, isActive: true, notes: null });
      onSaved();
    },
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? `Επεξεργασία — ${item?.name}` : "Νέο υποκατάστημα"}
      </DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός" required value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 12) })}
              sx={{ width: 160 }} placeholder="HQ / THES / PAT" />
            <TextField label="Όνομα" required fullWidth value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Υποκατάστημα Θεσσαλονίκης" />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Πόλη" fullWidth value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField label="ΤΚ" value={form.postalCode ?? ""}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              sx={{ width: 140 }} />
          </Stack>

          <TextField label="Διεύθυνση" fullWidth value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Τηλέφωνο" fullWidth value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Email" fullWidth value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Stack>

          <TextField label="Σημειώσεις" multiline minRows={2} fullWidth value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <Stack direction="row" spacing={3}>
            <FormControlLabel
              control={<Switch checked={form.isHeadquarters}
                onChange={(e) => setForm({ ...form, isHeadquarters: e.target.checked })} />}
              label="Κεντρικό υποκατάστημα" />
            <FormControlLabel
              control={<Switch checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label={form.isActive ? "Ενεργό" : "Ανενεργό"} />
          </Stack>

          {!form.isHeadquarters && form.isActive && (
            <Alert severity="info" icon={false}>
              <strong>Σημείωση χρέωσης:</strong> Κάθε υποκατάστημα πέρα από το κεντρικό χρεώνεται
              ξεχωριστά στη μηνιαία συνδρομή. Η ακριβής τιμή φαίνεται στο τιμολόγιό σας.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !form.code.trim() || !form.name.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
