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
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "../api/client";
import { DataExportButton } from "../components/DataExportButton";

interface CompanyDto {
  id: string;
  name: string;
  code: string;
  country: string | null;
  website: string | null;
  isActive: boolean;
  tenantId: string | null;
  isGlobal: boolean;
  tenantCopyId: string | null;
  isImportedToTenant: boolean;
  bridgeId: string | null;
  bridgeLinked: boolean;
  commissionDefaultCount: number;
  parameterItemCount: number;
  agentCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  afmVat: string | null;
  notes: string | null;
  isBroker?: boolean;
  parentCompanyId?: string | null;
}

interface UpsertBody {
  name: string; code: string; country: string | null; website: string | null; isActive: boolean;
  agentCode: string | null; contactName: string | null; contactEmail: string | null;
  contactPhone: string | null; afmVat: string | null; notes: string | null;
  createBridge: boolean; bridgeName: string | null; bridgeAutoSync: boolean; bridgeConfigJson: string | null;
  installZeroCommissionDefaults: boolean;
}

export function InsuranceCompaniesPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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


  // Re-order the global list so each broker is followed by its subcompanies
  // grouped underneath. Top-level standalone carriers stay in alphabetical
  // order. Standalone agency-added carriers (ownRows) keep their original order.
  const allGlobal = (q.data ?? []).filter(c => c.isGlobal);
  const topLevel = allGlobal.filter(c => !c.parentCompanyId);
  const grouped: CompanyDto[] = [];
  for (const top of topLevel) {
    grouped.push(top);
    const subs = allGlobal.filter(c => c.parentCompanyId === top.id);
    for (const s of subs) grouped.push(s);
  }
  const globalRows = grouped;
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <DataExportButton entity="insurance-companies" />
          <Button size="large" variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Νέα ασφαλιστική
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>
        Οι καθολικές εταιρείες Kalypsis είναι ήδη ορατές σε όλα τα γραφεία — δεν χρειάζεται εισαγωγή. Δουλέψτε απευθείας με τις καθολικές εγγραφές.
      </Alert>

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
  // Track which brokers are expanded. Collapsed by default so the table
  // doesn't dump 56 rows of subs onto the user; clicking the chevron on a
  // broker row reveals its subs.
  const [expandedBrokerIds, setExpandedBrokerIds] = useState<Set<string>>(new Set());
  const toggleBroker = (id: string) => {
    setExpandedBrokerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // How many subs each broker has, for the badge on the broker row.
  const subCountByBroker = new Map<string, number>();
  for (const r of rows) {
    if (r.parentCompanyId) {
      subCountByBroker.set(r.parentCompanyId, (subCountByBroker.get(r.parentCompanyId) ?? 0) + 1);
    }
  }
  // Filter: sub rows are hidden unless their broker is expanded.
  const visibleRows = rows.filter(r =>
    !r.parentCompanyId || expandedBrokerIds.has(r.parentCompanyId)
  );

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 32 }} />
            <TableCell>Κωδικός</TableCell>
            <TableCell>Όνομα</TableCell>
            <TableCell>Κωδικός συνεργασίας</TableCell>
            <TableCell>Επικοινωνία</TableCell>
            <TableCell>Κατάσταση</TableCell>
            <TableCell>Γέφυρα</TableCell>
            <TableCell align="right">Παραμετρικά</TableCell>
            <TableCell align="right">Κανόνες</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.map((r) => {
            const subCount = r.isBroker ? subCountByBroker.get(r.id) ?? 0 : 0;
            const expanded = expandedBrokerIds.has(r.id);
            return (
            <TableRow key={r.id} hover
              sx={r.parentCompanyId ? { bgcolor: "rgba(11,37,69,0.02)" } : undefined}>
              <TableCell sx={{ width: 32, p: 0.5 }}>
                {r.isBroker && subCount > 0 && (
                  <IconButton size="small" onClick={() => toggleBroker(r.id)} aria-label={expanded ? "Σύμπτυξη" : "Επέκταση"}>
                    {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                  </IconButton>
                )}
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, pl: r.parentCompanyId ? 4 : 0 }}>
                {r.parentCompanyId ? "↳ " : ""}{r.code}
              </TableCell>
              <TableCell>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography fontWeight={600} sx={{ color: r.parentCompanyId ? "text.secondary" : "text.primary" }}>
                    {r.name}
                  </Typography>
                  {r.isBroker && <Chip size="small" label="πρακτορείο" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
                  {r.isBroker && subCount > 0 && (
                    <Chip size="small" variant="outlined"
                      label={`${subCount} υποασφαλιστικές`}
                      sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
                      onClick={() => toggleBroker(r.id)} />
                  )}
                </Stack>
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
              <TableCell>
                {r.parentCompanyId ? (
                  // Subs share the broker's bridge — they don't have their own.
                  <Chip size="small" variant="outlined" label="Μέσω πρακτορείου" sx={{ color: "text.secondary" }} />
                ) : (
                  <Chip
                    size="small"
                    color={r.bridgeLinked ? "primary" : "warning"}
                    variant={r.bridgeLinked ? "filled" : "outlined"}
                    label={r.bridgeLinked ? "Συνδεδεμένη" : "Χωρίς γέφυρα"}
                  />
                )}
              </TableCell>
              <TableCell align="right">
                <Chip size="small" color={r.parameterItemCount > 0 ? "success" : "warning"} variant="outlined" label={r.parameterItemCount} />
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.commissionDefaultCount}</TableCell>
              <TableCell align="right">
                {readonly ? (
                  <Chip size="small" variant="outlined" label="Καθολική" />
                ) : (
                  <>
                    <IconButton size="small" onClick={() => onEdit?.(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => onDelete?.(r.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </TableCell>
            </TableRow>
            );
          })}
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
    afmVat: null, notes: null,
    createBridge: true,
    bridgeName: null,
    bridgeAutoSync: false,
    bridgeConfigJson: "{\"mode\":\"manual\",\"status\":\"pending-configuration\"}",
    installZeroCommissionDefaults: true
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, code: item.code, country: item.country, website: item.website, isActive: item.isActive,
        agentCode: item.agentCode, contactName: item.contactName, contactEmail: item.contactEmail,
        contactPhone: item.contactPhone, afmVat: item.afmVat, notes: item.notes,
        createBridge: true,
        bridgeName: item.bridgeLinked ? null : `${item.name} bridge`,
        bridgeAutoSync: false,
        bridgeConfigJson: item.bridgeLinked ? null : "{\"mode\":\"manual\",\"status\":\"pending-configuration\"}",
        installZeroCommissionDefaults: item.commissionDefaultCount === 0
      });
    } else if (open) {
      setForm({
        name: "", code: "", country: "Ελλάδα", website: null, isActive: true,
        agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
        afmVat: null, notes: null,
        createBridge: true,
        bridgeName: null,
        bridgeAutoSync: false,
        bridgeConfigJson: "{\"mode\":\"manual\",\"status\":\"pending-configuration\"}",
        installZeroCommissionDefaults: true
      });
    }
  }, [item, open]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        country: form.country?.trim() || null,
        website: form.website?.trim() || null,
        agentCode: form.agentCode?.trim() || null,
        contactName: form.contactName?.trim() || null,
        contactEmail: form.contactEmail?.trim() || null,
        contactPhone: form.contactPhone?.trim() || null,
        afmVat: form.afmVat?.trim() || null,
        notes: form.notes?.trim() || null,
        bridgeName: form.createBridge ? (form.bridgeName?.trim() || null) : null,
        bridgeConfigJson: form.createBridge ? (form.bridgeConfigJson?.trim() || null) : null
      };
      if (item) return (await api.put(`/insurance-companies/${item.id}`, body)).data;
      return (await api.post(`/insurance-companies`, body)).data;
    },
    onSuccess: onSaved,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
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
          <Alert severity="info">
            Η γέφυρα και οι μηδενικοί κανόνες προμηθειών δημιουργούνται από εδώ ώστε η εταιρεία να μη μείνει μισο-παραμετροποιημένη.
          </Alert>
          <FormControlLabel control={<Switch checked={form.createBridge}
            onChange={(e) => setForm({ ...form, createBridge: e.target.checked })} />}
            label="Δημιουργία / σύνδεση γέφυρας" />
          {form.createBridge && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Όνομα γέφυρας" fullWidth value={form.bridgeName ?? ""}
                  onChange={(e) => setForm({ ...form, bridgeName: e.target.value })}
                  placeholder="Αφήστε κενό για αυτόματο όνομα" />
                <FormControlLabel control={<Switch checked={form.bridgeAutoSync}
                  onChange={(e) => setForm({ ...form, bridgeAutoSync: e.target.checked })} />}
                  label="Αυτόματος συγχρονισμός" />
              </Stack>
              <TextField label="Ρυθμίσεις γέφυρας (JSON)" multiline minRows={2} fullWidth value={form.bridgeConfigJson ?? ""}
                onChange={(e) => setForm({ ...form, bridgeConfigJson: e.target.value })}
                helperText="Προτείνεται να μείνει το ασφαλές placeholder μέχρι να δοθούν τα πραγματικά στοιχεία σύνδεσης." />
            </Stack>
          )}
          <FormControlLabel control={<Switch checked={form.installZeroCommissionDefaults}
            onChange={(e) => setForm({ ...form, installZeroCommissionDefaults: e.target.checked })} />}
            label="Δημιουργία μηδενικών κανόνων προμηθειών για όλους τους κλάδους/χρήσεις" />
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
