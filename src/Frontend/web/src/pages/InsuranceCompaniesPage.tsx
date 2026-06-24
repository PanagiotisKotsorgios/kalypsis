import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
import PublicIcon from "@mui/icons-material/Public";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

interface CompanyDto {
  id: string;
  name: string;
  code: string;
  country: string | null;
  website: string | null;
  isActive: boolean;
  tenantId: string | null;
  isGlobal: boolean;
  agentCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  afmVat: string | null;
  notes: string | null;
}

interface UpsertBody {
  name: string; code: string; country: string | null; website: string | null; isActive: boolean;
  agentCode: string | null; contactName: string | null; contactEmail: string | null;
  contactPhone: string | null; afmVat: string | null; notes: string | null;
}

export function InsuranceCompaniesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyDto | null>(null);

  const q = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get<CompanyDto[]>("/insurance-companies")).data
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/insurance-companies/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["insurance-companies"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const globalRows = (q.data ?? []).filter(c => c.isGlobal);
  const ownRows = (q.data ?? []).filter(c => !c.isGlobal);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <BusinessIcon sx={{ fontSize: 36 }} color="primary" />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Ασφαλιστικές Εταιρείες</Typography>
            <Typography color="text.secondary">
              Καθολικός κατάλογος + εταιρείες που πρόσθεσε το γραφείο σας. Διαχειριστείτε ξεχωριστά τις δικές σας συνεργασίες.
            </Typography>
          </Box>
        </Stack>
        <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέα ασφαλιστική
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={3}>
          {/* Tenant-owned section */}
          <Card variant="outlined">
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <BusinessIcon sx={{ color: "primary.main" }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Δικές μου ασφαλιστικές</Typography>
                <Chip size="small" label={ownRows.length} />
              </Stack>
            </Box>
            {ownRows.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
                Δεν έχετε προσθέσει ακόμη δικές σας ασφαλιστικές. Πατήστε «Νέα ασφαλιστική» επάνω δεξιά.
              </Box>
            ) : (
              <CompanyTable rows={ownRows} onEdit={setEditing} onDelete={(id) => {
                if (confirm("Διαγραφή ασφαλιστικής;")) del.mutate(id);
              }} />
            )}
          </Card>

          {/* Global section */}
          <Card variant="outlined">
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <PublicIcon sx={{ color: "text.secondary" }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Καθολικός κατάλογος Kalypsis</Typography>
                <Chip size="small" label={globalRows.length} variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Διαχειρίζεται από την Kalypsis · κοινός σε όλα τα γραφεία
              </Typography>
            </Box>
            <CompanyTable rows={globalRows} readonly />
          </Card>
        </Stack>
      )}

      <CompanyDialog open={createOpen} onClose={() => setCreateOpen(false)} item={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); setCreateOpen(false); }} />
      <CompanyDialog open={!!editing} onClose={() => setEditing(null)} item={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["insurance-companies"] }); setEditing(null); }} />
    </Box>
  );
}

function CompanyTable({ rows, onEdit, onDelete, readonly }: {
  rows: CompanyDto[];
  onEdit?: (c: CompanyDto) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Κωδικός</TableCell>
            <TableCell>Όνομα</TableCell>
            <TableCell>Κωδικός συνεργασίας</TableCell>
            <TableCell>Επικοινωνία</TableCell>
            <TableCell>Κατάσταση</TableCell>
            {!readonly && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>{r.code}</TableCell>
              <TableCell>
                <Typography fontWeight={600}>{r.name}</Typography>
                {r.country && <Typography variant="caption" color="text.secondary">{r.country}</Typography>}
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>{r.agentCode ?? "—"}</TableCell>
              <TableCell sx={{ fontSize: 13 }}>
                {r.contactName && <div>{r.contactName}</div>}
                {r.contactEmail && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.contactEmail}</Typography>}
                {r.contactPhone && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{r.contactPhone}</Typography>}
                {!r.contactName && !r.contactEmail && !r.contactPhone && "—"}
              </TableCell>
              <TableCell>
                <Chip size="small" color={r.isActive ? "success" : "default"} label={r.isActive ? "Ενεργή" : "Ανενεργή"} />
              </TableCell>
              {!readonly && (
                <TableCell align="right">
                  <IconButton size="small" onClick={() => onEdit?.(r)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => onDelete?.(r.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function CompanyDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void; item: CompanyDto | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<UpsertBody>({
    name: "", code: "", country: "Ελλάδα", website: null, isActive: true,
    agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
    afmVat: null, notes: null
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, code: item.code, country: item.country, website: item.website, isActive: item.isActive,
        agentCode: item.agentCode, contactName: item.contactName, contactEmail: item.contactEmail,
        contactPhone: item.contactPhone, afmVat: item.afmVat, notes: item.notes
      });
    } else if (open) {
      setForm({
        name: "", code: "", country: "Ελλάδα", website: null, isActive: true,
        agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
        afmVat: null, notes: null
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form,
        country: form.country?.trim() || null,
        website: form.website?.trim() || null,
        agentCode: form.agentCode?.trim() || null,
        contactName: form.contactName?.trim() || null,
        contactEmail: form.contactEmail?.trim() || null,
        contactPhone: form.contactPhone?.trim() || null,
        afmVat: form.afmVat?.trim() || null,
        notes: form.notes?.trim() || null
      };
      if (item) return (await api.put(`/insurance-companies/${item.id}`, body)).data;
      return (await api.post(`/insurance-companies`, body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>{item ? "Επεξεργασία ασφαλιστικής" : "Νέα ασφαλιστική εταιρεία"}</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        <Stack spacing={2} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός" required value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              sx={{ width: 160 }} placeholder="INTERAMERICAN" />
            <TextField label="Όνομα" required fullWidth value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Χώρα" fullWidth value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <TextField label="Website" fullWidth value={form.website ?? ""}
              onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Κωδικός συνεργασίας" fullWidth value={form.agentCode ?? ""}
              onChange={(e) => setForm({ ...form, agentCode: e.target.value })}
              placeholder="π.χ. AGT-12345" />
            <TextField label="ΑΦΜ" value={form.afmVat ?? ""}
              onChange={(e) => setForm({ ...form, afmVat: e.target.value })} sx={{ width: 160 }} />
          </Stack>
          <Typography variant="caption" color="text.secondary">Επικοινωνία</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Όνομα επαφής" fullWidth value={form.contactName ?? ""}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <TextField label="Email" fullWidth value={form.contactEmail ?? ""}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            <TextField label="Τηλέφωνο" value={form.contactPhone ?? ""}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} sx={{ width: 200 }} />
          </Stack>
          <TextField label="Σημειώσεις" multiline minRows={2} fullWidth value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <FormControlLabel control={<Switch checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
            label={form.isActive ? "Ενεργή" : "Ανενεργή"} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Άκυρο</Button>
        <Button variant="contained" disabled={save.isPending || !form.name.trim() || !form.code.trim()}
          onClick={() => save.mutate()}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
