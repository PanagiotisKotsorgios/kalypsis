import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import EngineeringIcon from "@mui/icons-material/Engineering";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * Ανεξάρτητοι Συνεργάτες — Independent contractors that manage tenant
 * back-offices at a custom monthly price (outside the standard subscription).
 *
 * The SuperAdmin registers contractors + assigns each one to one or more
 * γραφεία with a per-office monthly rate. Kalypsis bills the tenant for the
 * standard subscription; the contractor arrangement here tracks who
 * physically operates that back-office and at what price the tenant pays
 * the contractor (so the SuperAdmin can see total contractor-driven revenue
 * across the fleet).
 *
 * First-pass persistence is localStorage — a proper backend model
 * (Contractor entity + ContractorAssignment) lands in a follow-up. This
 * lets the SuperAdmin start recording assignments today.
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

const CONTRACTORS_KEY = "kalypsis.contractors.v1";
const ASSIGNMENTS_KEY = "kalypsis.contractorAssignments.v1";

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}
function writeList<T>(key: string, list: T[]) {
  window.localStorage.setItem(key, JSON.stringify(list));
}

const uid = () => (crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const moneyFmt = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function PlatformContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>(() => readList<Contractor>(CONTRACTORS_KEY));
  const [assignments, setAssignments] = useState<Assignment[]>(() => readList<Assignment>(ASSIGNMENTS_KEY));
  const [contractorDialog, setContractorDialog] = useState<Contractor | null | "new">(null);
  const [assignDialog, setAssignDialog] = useState<Assignment | null | { forContractorId: string }>(null);

  const tenantsQ = useQuery({
    queryKey: ["all-tenants-contractors"],
    queryFn: async () => (await api.get<Tenant[]>("/tenants")).data
  });

  const saveContractors = useCallback((next: Contractor[]) => {
    setContractors(next);
    writeList(CONTRACTORS_KEY, next);
  }, []);
  const saveAssignments = useCallback((next: Assignment[]) => {
    setAssignments(next);
    writeList(ASSIGNMENTS_KEY, next);
  }, []);

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

      <Alert severity="info" sx={{ mb: 3 }}>
        Πρώτη φάση: αποθήκευση τοπικά (localStorage). Backend model έρχεται σε επόμενη έκδοση.
      </Alert>

      {/* Stats */}
      <Box sx={{ display: "grid", gap: 2, mb: 3, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        <Kpi label="Ενεργοί συνεργάτες" value={`${stats.activeContractors} / ${stats.totalContractors}`} />
        <Kpi label="Ενεργές αναθέσεις"  value={stats.activeAssignments} />
        <Kpi label="Γραφεία υπό διαχείριση" value={stats.officesCovered} />
        <Kpi label="Μηνιαία έσοδα συνεργατών" value={moneyFmt.format(stats.totalMonthly)} highlight />
      </Box>

      {/* Contractors */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>
            <BusinessCenterIcon sx={{ verticalAlign: "middle", mr: 1 }} fontSize="small" />
            Συνεργάτες
          </Typography>
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
                  {contractors.map(c => {
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
                              saveContractors(contractors.filter(x => x.id !== c.id));
                              saveAssignments(assignments.filter(a => a.contractorId !== c.id));
                            }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>Αναθέσεις γραφείων</Typography>
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
                  {assignments.map(a => {
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
                              saveAssignments(assignments.filter(x => x.id !== a.id));
                            }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <ContractorDialog
        open={!!contractorDialog}
        contractor={contractorDialog === "new" ? null : contractorDialog}
        onClose={() => setContractorDialog(null)}
        onSave={(c) => {
          const list = contractors.some(x => x.id === c.id)
            ? contractors.map(x => x.id === c.id ? c : x)
            : [...contractors, c];
          saveContractors(list);
          setContractorDialog(null);
        }}
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
        onSave={(a) => {
          const list = assignments.some(x => x.id === a.id)
            ? assignments.map(x => x.id === a.id ? a : x)
            : [...assignments, a];
          saveAssignments(list);
          setAssignDialog(null);
        }}
      />
    </Box>
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

function ContractorDialog({ open, contractor, onClose, onSave }: {
  open: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onSave: (c: Contractor) => void;
}) {
  const [form, setForm] = useState<Contractor>(() => contractor ?? {
    id: uid(), name: "", email: "", phone: null, afmVat: null,
    active: true, notes: null, createdAt: new Date().toISOString()
  });
  useEffect(() => {
    if (!open) return;
    setForm(contractor ?? {
      id: uid(), name: "", email: "", phone: null, afmVat: null,
      active: true, notes: null, createdAt: new Date().toISOString()
    });
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
        <Button variant="contained" disabled={!valid} onClick={() => onSave(form)}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignmentDialog({ open, assignment, defaultContractorId, contractors, tenants, onClose, onSave }: {
  open: boolean;
  assignment: Assignment | null;
  defaultContractorId: string | null;
  contractors: Contractor[];
  tenants: Tenant[];
  onClose: () => void;
  onSave: (a: Assignment) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Assignment>(() => assignment ?? {
    id: uid(), contractorId: defaultContractorId ?? "", tenantId: "",
    monthlyPrice: 100, currency: "EUR", startedOn: today, endedOn: null, notes: null
  });
  useEffect(() => {
    if (!open) return;
    setForm(assignment ?? {
      id: uid(), contractorId: defaultContractorId ?? "", tenantId: "",
      monthlyPrice: 100, currency: "EUR", startedOn: today, endedOn: null, notes: null
    });
  }, [open, assignment, defaultContractorId, today]);
  const valid = form.contractorId && form.tenantId && form.monthlyPrice >= 0;
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
              value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} />
            <TextField label="Λήξη (αν έληξε)" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.endedOn ?? ""} onChange={(e) => setForm({ ...form, endedOn: e.target.value || null })} />
          </Stack>
          <TextField label="Σημειώσεις" fullWidth multiline minRows={2}
            value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ακύρωση</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onSave(form)}>Αποθήκευση</Button>
      </DialogActions>
    </Dialog>
  );
}
