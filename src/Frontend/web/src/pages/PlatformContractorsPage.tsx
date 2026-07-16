import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import EngineeringIcon from "@mui/icons-material/Engineering";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";

/**
 * Ανεξάρτητοι Συνεργάτες — Backend-persisted via /api/platform/contractors.
 *
 * SuperAdmin registers contractors + assigns each to one or more γραφεία
 * with a per-office monthly rate. Kalypsis bills the tenant for the standard
 * subscription separately; the contractor arrangement here tracks who
 * physically operates the back-office and at what price the tenant pays
 * the contractor.
 */

interface Contractor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  afmVat: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
}

interface Assignment {
  id: string;
  contractorId: string;
  tenantId: string;
  monthlyPrice: number;
  currency: string;
  startedOn: string;
  endedOn: string | null;
  notes: string | null;
}

interface Tenant { id: string; name: string; code: string; }

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function PlatformContractorsPage() {
  const qc = useQueryClient();
  const [contractorDialog, setContractorDialog] = useState<Contractor | null | "new">(null);
  const [assignDialog, setAssignDialog] = useState<Assignment | null | { forContractorId: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const contractorsQ = useQuery({
    queryKey: ["platform-contractors"],
    queryFn: async () => (await api.get<Contractor[]>("/platform/contractors")).data
  });
  const assignmentsQ = useQuery({
    queryKey: ["platform-contractors-assignments"],
    queryFn: async () => (await api.get<Assignment[]>("/platform/contractors/assignments")).data
  });
  const tenantsQ = useQuery({
    queryKey: ["all-tenants-contractors"],
    queryFn: async () => (await api.get<Tenant[]>("/tenants")).data
  });

  const contractors = contractorsQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];

  // Client-side search + pagination for both tables. Contractors + assignments
  // are unlikely to exceed a few dozen rows, but the search bar keeps the
  // page usable even at fleet-scale (100+ contractors managing 200+ offices).
  const [contractorSearch, setContractorSearch] = useState("");
  const [contractorPage, setContractorPage] = useState(1);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignPage, setAssignPage] = useState(1);
  const PAGE_SIZE = 15;

  const filteredContractors = contractors.filter(c => {
    if (!contractorSearch) return true;
    const s = contractorSearch.toLowerCase();
    return c.name.toLowerCase().includes(s)
      || c.email.toLowerCase().includes(s)
      || (c.afmVat ?? "").toLowerCase().includes(s);
  });
  const contractorPageCount = Math.max(1, Math.ceil(filteredContractors.length / PAGE_SIZE));
  const pagedContractors = filteredContractors.slice((contractorPage - 1) * PAGE_SIZE, contractorPage * PAGE_SIZE);

  const filteredAssignments = assignments.filter(a => {
    if (!assignSearch) return true;
    const s = assignSearch.toLowerCase();
    const contractor = contractors.find(c => c.id === a.contractorId);
    return (contractor?.name.toLowerCase().includes(s) ?? false);
  });
  const assignPageCount = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));
  const pagedAssignments = filteredAssignments.slice((assignPage - 1) * PAGE_SIZE, assignPage * PAGE_SIZE);

  useEffect(() => { setContractorPage(1); }, [contractorSearch]);
  useEffect(() => { setAssignPage(1); }, [assignSearch]);

  const upsertContractor = useMutation({
    mutationFn: async (c: Contractor) => {
      const body = { name: c.name, email: c.email, phone: c.phone, afmVat: c.afmVat, active: c.active, notes: c.notes };
      if (c.id && contractors.some(x => x.id === c.id))
        return (await api.put<Contractor>(`/platform/contractors/${c.id}`, body)).data;
      return (await api.post<Contractor>("/platform/contractors", body)).data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["platform-contractors"] }); setContractorDialog(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });
  const deleteContractor = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/platform/contractors/${id}`); },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-contractors"] });
      void qc.invalidateQueries({ queryKey: ["platform-contractors-assignments"] });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });
  const upsertAssignment = useMutation({
    mutationFn: async (a: Assignment) => {
      const body = {
        contractorId: a.contractorId, tenantId: a.tenantId,
        monthlyPrice: a.monthlyPrice, currency: a.currency,
        startedOn: a.startedOn, endedOn: a.endedOn, notes: a.notes
      };
      if (a.id && assignments.some(x => x.id === a.id))
        return (await api.put<Assignment>(`/platform/contractors/assignments/${a.id}`, body)).data;
      return (await api.post<Assignment>("/platform/contractors/assignments", body)).data;
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["platform-contractors-assignments"] }); setAssignDialog(null); },
    onError: (e) => setError(extractErrorMessage(e))
  });
  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/platform/contractors/assignments/${id}`); },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["platform-contractors-assignments"] }),
    onError: (e) => setError(extractErrorMessage(e))
  });

  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    for (const t of tenantsQ.data ?? []) m.set(t.id, t);
    return m;
  }, [tenantsQ.data]);

  const stats = useMemo(() => {
    const active = assignments.filter(a => !a.endedOn);
    const totalMonthly = active.reduce((s, a) => s + a.monthlyPrice, 0);
    const uniqueTenants = new Set(active.map(a => a.tenantId));
    return {
      activeContractors: contractors.filter(c => c.active).length,
      totalContractors: contractors.length,
      activeAssignments: active.length,
      officesCovered: uniqueTenants.size,
      totalMonthly
    };
  }, [contractors, assignments]);

  if (contractorsQ.isLoading || assignmentsQ.isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3} flexWrap="wrap" gap={2}>
        <EngineeringIcon sx={{ fontSize: 36 }} color="primary" />
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Ανεξάρτητοι Συνεργάτες</Typography>
          <Typography color="text.secondary">
            Εξωτερικοί συνεργάτες που διαχειρίζονται το BackOffice γραφείων σε custom μηνιαία τιμή. Kalypsis SaaS
            συνδρομή + contractor fee = συνολικό κόστος για το γραφείο.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setContractorDialog("new")}>
          Νέος συνεργάτης
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: "grid", gap: 2, mb: 3, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        <Kpi label="Ενεργοί συνεργάτες" value={`${stats.activeContractors} / ${stats.totalContractors}`} />
        <Kpi label="Ενεργές αναθέσεις"  value={stats.activeAssignments} />
        <Kpi label="Γραφεία υπό διαχείριση" value={stats.officesCovered} />
        <Kpi label="Μηνιαία έσοδα συνεργατών" value={moneyFmt.format(stats.totalMonthly)} highlight />
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} mb={2}>
            <Typography variant="h6" fontWeight={700}>
              <BusinessCenterIcon sx={{ verticalAlign: "middle", mr: 1 }} fontSize="small" />
              Συνεργάτες
            </Typography>
            <Box sx={{ flex: 1 }} />
            {contractors.length > 0 && (
              <>
                <TextField size="small" label="Αναζήτηση (όνομα / email / ΑΦΜ)"
                  value={contractorSearch}
                  onChange={(e) => setContractorSearch(e.target.value)}
                  sx={{ minWidth: 280 }} />
                <Chip size="small" label={`${filteredContractors.length} από ${contractors.length}`} />
              </>
            )}
          </Stack>
          {contractors.length === 0 ? (
            <Alert severity="warning">
              Δεν έχετε καταχωρήσει συνεργάτες. Πατήστε «Νέος συνεργάτης» για να ξεκινήσετε.
            </Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Όνομα</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Τηλέφωνο</TableCell>
                    <TableCell>ΑΦΜ</TableCell>
                    <TableCell align="right">Ενεργές αναθέσεις</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell align="right">Ενέργειες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedContractors.length === 0 && (
                    <TableRow><TableCell colSpan={7} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                      Κανένας συνεργάτης δεν ταιριάζει στην αναζήτηση.
                    </TableCell></TableRow>
                  )}
                  {pagedContractors.map(c => {
                    const active = assignments.filter(a => a.contractorId === c.id && !a.endedOn);
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell><Typography fontWeight={600}>{c.name}</Typography></TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>{c.phone ?? "—"}</TableCell>
                        <TableCell sx={{ fontFamily: "monospace" }}>{c.afmVat ?? "—"}</TableCell>
                        <TableCell align="right">{active.length}</TableCell>
                        <TableCell>
                          <Chip size="small" color={c.active ? "success" : "default"}
                            label={c.active ? "Ενεργός" : "Ανενεργός"} />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Νέα ανάθεση σε γραφείο">
                            <IconButton size="small" color="primary"
                              onClick={() => setAssignDialog({ forContractorId: c.id })}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small" onClick={() => setContractorDialog(c)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error"
                            onClick={() => {
                              if (!confirm(`Διαγραφή συνεργάτη ${c.name}; Θα αφαιρεθούν και οι αναθέσεις.`)) return;
                              deleteContractor.mutate(c.id);
                            }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {contractorPageCount > 1 && (
                <Pager page={contractorPage} pageCount={contractorPageCount} onPage={setContractorPage} />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} mb={2}>
            <Typography variant="h6" fontWeight={700}>Αναθέσεις γραφείων</Typography>
            <Box sx={{ flex: 1 }} />
            {assignments.length > 0 && (
              <>
                <TextField size="small" label="Αναζήτηση (όνομα συνεργάτη)"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  sx={{ minWidth: 260 }} />
                <Chip size="small" label={`${filteredAssignments.length} από ${assignments.length}`} />
              </>
            )}
          </Stack>
          {assignments.length === 0 ? (
            <Alert severity="warning">
              Καμία ανάθεση. Επιλέξτε έναν συνεργάτη παραπάνω και πατήστε «+» για να τον αναθέσετε σε γραφείο.
            </Alert>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Συνεργάτης</TableCell>
                    <TableCell>Γραφείο</TableCell>
                    <TableCell align="right">Μηνιαία τιμή</TableCell>
                    <TableCell>Έναρξη</TableCell>
                    <TableCell>Λήξη</TableCell>
                    <TableCell>Κατάσταση</TableCell>
                    <TableCell align="right">Ενέργειες</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedAssignments.length === 0 && (
                    <TableRow><TableCell colSpan={7} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>
                      Καμία ανάθεση δεν ταιριάζει στην αναζήτηση.
                    </TableCell></TableRow>
                  )}
                  {pagedAssignments.map(a => {
                    const c = contractors.find(x => x.id === a.contractorId);
                    const t = tenantById.get(a.tenantId);
                    const active = !a.endedOn;
                    return (
                      <TableRow key={a.id} hover>
                        <TableCell><Typography fontWeight={600}>{c?.name ?? "—"}</Typography></TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{t?.name ?? "—"}</Typography>
                          {t && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                            {t.code}
                          </Typography>}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {moneyFmt.format(a.monthlyPrice)}
                        </TableCell>
                        <TableCell>{new Date(a.startedOn).toLocaleDateString("el-GR")}</TableCell>
                        <TableCell>{a.endedOn ? new Date(a.endedOn).toLocaleDateString("el-GR") : "—"}</TableCell>
                        <TableCell>
                          <Chip size="small" color={active ? "success" : "default"}
                            label={active ? "Ενεργή" : "Ολοκληρώθηκε"} />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => setAssignDialog(a)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error"
                            onClick={() => {
                              if (!confirm("Διαγραφή ανάθεσης;")) return;
                              deleteAssignment.mutate(a.id);
                            }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {assignPageCount > 1 && (
                <Pager page={assignPage} pageCount={assignPageCount} onPage={setAssignPage} />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <ContractorDialog
        open={!!contractorDialog}
        contractor={contractorDialog === "new" ? null : contractorDialog}
        onClose={() => setContractorDialog(null)}
        onSave={(c) => upsertContractor.mutate(c)}
        busy={upsertContractor.isPending}
      />

      <AssignmentDialog
        open={!!assignDialog}
        assignment={
          assignDialog && "contractorId" in (assignDialog as any) && !("forContractorId" in (assignDialog as any))
            ? assignDialog as Assignment
            : null
        }
        defaultContractorId={
          assignDialog && "forContractorId" in (assignDialog as any)
            ? (assignDialog as { forContractorId: string }).forContractorId
            : null
        }
        contractors={contractors}
        tenants={tenantsQ.data ?? []}
        onClose={() => setAssignDialog(null)}
        onSave={(a) => upsertAssignment.mutate(a)}
        busy={upsertAssignment.isPending}
      />
    </Box>
  );
}

/** Reusable page navigation bar. Kept local since two tables on this page
 *  both need it and neither of them warrants a shared component elsewhere. */
function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (n: number) => void }) {
  const clamped = Math.min(page, pageCount);
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ p: 2 }}>
      <Button size="small" variant="outlined" disabled={page <= 1} onClick={() => onPage(1)}>«</Button>
      <Button size="small" variant="outlined" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>‹</Button>
      <Typography variant="body2" sx={{ minWidth: 140, textAlign: "center" }}>
        Σελίδα <strong>{clamped}</strong> από <strong>{pageCount}</strong>
      </Typography>
      <Button size="small" variant="outlined" disabled={page >= pageCount} onClick={() => onPage(Math.min(pageCount, page + 1))}>›</Button>
      <Button size="small" variant="outlined" disabled={page >= pageCount} onClick={() => onPage(pageCount)}>»</Button>
    </Stack>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card variant="outlined" sx={{ p: 2, ...(highlight ? { borderColor: "primary.main", borderWidth: 2 } : {}) }}>
      <Typography fontSize={12} color="text.secondary" sx={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, mt: 0.5 }}>{value}</Typography>
    </Card>
  );
}

const emptyContractor: Contractor = {
  id: "", name: "", email: "", phone: null, afmVat: null,
  active: true, notes: null, createdAt: new Date().toISOString()
};

function ContractorDialog({ open, contractor, onClose, onSave, busy }: {
  open: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onSave: (c: Contractor) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<Contractor>(emptyContractor);
  useEffect(() => {
    if (!open) return;
    setForm(contractor ?? emptyContractor);
  }, [open, contractor]);
  const valid = form.name.trim().length > 0 && form.email.trim().length > 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{contractor ? "Επεξεργασία συνεργάτη" : "Νέος συνεργάτης"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField label="Ονοματεπώνυμο / Επωνυμία" required fullWidth
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" required type="email" fullWidth
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField label="Τηλέφωνο" fullWidth
              value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} />
            <TextField label="ΑΦΜ" fullWidth
              value={form.afmVat ?? ""} onChange={(e) => setForm({ ...form, afmVat: e.target.value || null })} />
          </Stack>
          <TextField label="Σημειώσεις" fullWidth multiline minRows={2}
            value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
          <TextField label="Κατάσταση" select fullWidth
            value={form.active ? "active" : "inactive"}
            onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}>
            <MenuItem value="active">Ενεργός</MenuItem>
            <MenuItem value="inactive">Ανενεργός</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || busy} onClick={() => onSave(form)}>
          {busy ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignmentDialog({ open, assignment, defaultContractorId, contractors, tenants, onClose, onSave, busy }: {
  open: boolean;
  assignment: Assignment | null;
  defaultContractorId: string | null;
  contractors: Contractor[];
  tenants: Tenant[];
  onClose: () => void;
  onSave: (a: Assignment) => void;
  busy: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const empty: Assignment = {
    id: "", contractorId: defaultContractorId ?? "", tenantId: "",
    monthlyPrice: 100, currency: "EUR", startedOn: today, endedOn: null, notes: null
  };
  const [form, setForm] = useState<Assignment>(empty);
  useEffect(() => {
    if (!open) return;
    setForm(assignment ?? empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assignment, defaultContractorId]);
  const valid = !!form.contractorId && !!form.tenantId && form.monthlyPrice >= 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{assignment ? "Επεξεργασία ανάθεσης" : "Νέα ανάθεση συνεργάτη σε γραφείο"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField select label="Συνεργάτης" required fullWidth
            value={form.contractorId} onChange={(e) => setForm({ ...form, contractorId: e.target.value })}>
            {contractors.filter(c => c.active).map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Γραφείο" required fullWidth
            value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })}>
            {tenants.map(t => (
              <MenuItem key={t.id} value={t.id}>{t.name} ({t.code})</MenuItem>
            ))}
          </TextField>
          <TextField label="Μηνιαία τιμή (€)" required type="number" fullWidth
            value={form.monthlyPrice}
            onChange={(e) => setForm({ ...form, monthlyPrice: Number(e.target.value) })} />
          <Stack direction="row" spacing={2}>
            <TextField label="Έναρξη" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.startedOn.slice(0, 10)} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} />
            <TextField label="Λήξη (αν έληξε)" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={(form.endedOn ?? "").slice(0, 10)}
              onChange={(e) => setForm({ ...form, endedOn: e.target.value || null })} />
          </Stack>
          <TextField label="Σημειώσεις" fullWidth multiline minRows={2}
            value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" disabled={!valid || busy} onClick={() => onSave(form)}>
          {busy ? <CircularProgress size={16} /> : "Αποθήκευση"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
