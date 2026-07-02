import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
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
  isUsedByTenant?: boolean;
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

  // Toggle the tenant's opt-in for a universal (Kalypsis-managed) carrier.
  // Invalidates every other "insurance-companies*" query so filters elsewhere
  // (γέφυρες dropdowns, policy pickers) pick up the change without a hard
  // reload.
  const toggleOptIn = useMutation({
    mutationFn: async (args: { id: string; enable: boolean }) =>
      args.enable
        ? api.post(`/insurance-companies/${args.id}/opt-in`)
        : api.delete(`/insurance-companies/${args.id}/opt-in`),
    onSuccess: () => {
      void qc.invalidateQueries({ predicate: (q) =>
        typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("insurance-companies") });
    },
    onError: (e) => setError(extractErrorMessage(e))
  });


  // "Δικές μου ασφαλιστικές" lists tenant-owned rows + universal rows the
  // tenant has opted-in to. The catalog section below keeps showing the FULL
  // universal list regardless of opt-in state — the row's status badge
  // (Ενταγμένη / Διαθέσιμη) is what tells the operator whether they've
  // already ticked it. This mirrors how real insurance CRMs render their
  // carrier catalogs: the master list is stable, per-tenant status floats
  // on top of it.
  const allData = q.data ?? [];
  const allGlobal = allData.filter(c => c.isGlobal);
  const usedGlobal = allGlobal.filter(c => c.isUsedByTenant);

  const groupByBroker = (rows: CompanyDto[]): CompanyDto[] => {
    const topLevel = rows.filter(c => !c.parentCompanyId);
    const out: CompanyDto[] = [];
    for (const top of topLevel) {
      out.push(top);
      for (const s of rows.filter(c => c.parentCompanyId === top.id)) out.push(s);
    }
    return out;
  };
  const allGlobalGrouped = groupByBroker(allGlobal);
  const usedGlobalGrouped = groupByBroker(usedGlobal);
  const ownTenantRows = allData.filter(c => !c.isGlobal);
  const ownRows = [...ownTenantRows, ...usedGlobalGrouped];
  const globalRows = allGlobalGrouped;

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
          {/* "Νέα ασφαλιστική" removed — every duplicate of a global was being
              rejected anyway. New carriers are added by the platform admin
              from /platform/carriers. */}
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
                Δεν υπάρχουν δικές σας ασφαλιστικές. Τσεκάρετε από τον καθολικό κατάλογο παρακάτω όσες χρησιμοποιείτε.
              </Box>
            ) : (
              <CompanyTable rows={ownRows} onEdit={setEditing} onDelete={(id) => {
                if (confirm("Διαγραφή ασφαλιστικής;")) del.mutate(id);
              }} onToggleOptIn={(id, enable) => toggleOptIn.mutate({ id, enable })} />
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
            <CompanyTable rows={globalRows} readonly
              onToggleOptIn={(id, enable) => toggleOptIn.mutate({ id, enable })} />
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

function CompanyTable({ rows, onEdit, onDelete, readonly, onToggleOptIn }: {
  rows: CompanyDto[];
  onEdit?: (c: CompanyDto) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  // Only wired for the universal-catalog table — flips the tenant's opt-in.
  onToggleOptIn?: (id: string, enable: boolean) => void;
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
            {onToggleOptIn && (
              <TableCell align="center" sx={{ width: 60 }}>
                <Tooltip title="Χρησιμοποιώ αυτή την εταιρεία — εμφανίζεται στις γέφυρες, στους πίνακες και στα φίλτρα.">
                  <span>Χρησιμοποιώ</span>
                </Tooltip>
              </TableCell>
            )}
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
              {onToggleOptIn && (
                <TableCell align="center" sx={{ width: 60, p: 0.5 }}>
                  {/* Sub-carriers inherit from their broker — the broker's
                      opt-in gates them.
                      Tenant-owned rows (isGlobal=false) aren't opt-in at all;
                      they're implicitly used and get removed via the delete
                      icon, not the checkbox — so we hide the checkbox for
                      them too. */}
                  {r.parentCompanyId || !r.isGlobal ? null : (
                    <Checkbox
                      size="small"
                      checked={!!r.isUsedByTenant}
                      onChange={(e) => onToggleOptIn(r.id, e.target.checked)}
                      inputProps={{ "aria-label": `Χρησιμοποιώ ${r.name}` }}
                    />
                  )}
                </TableCell>
              )}
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
                ) : (() => {
                  // Three tiers of availability:
                  //   1. Συνδεδεμένη — tenant already has a CompanyBridge row
                  //      (usually created on first commit).
                  //   2. Αναλυτής διαθέσιμος — the platform ships a parser
                  //      for this carrier, so the operator can upload today.
                  //   3. Χωρίς γέφυρα — no parser exists yet.
                  const code = (r.code ?? "").toUpperCase();
                  const analyzerAvailable =
                    code.includes("ERGO") ||
                    code.includes("GRAND_COVER") || code.includes("GRANDCOVER") ||
                    code.includes("ATLANTIC");
                  if (r.bridgeLinked) {
                    return <Chip size="small" color="primary" label="Συνδεδεμένη" />;
                  }
                  if (analyzerAvailable) {
                    return <Chip size="small" color="info" variant="outlined" label="Αναλυτής διαθέσιμος" />;
                  }
                  return <Chip size="small" color="warning" variant="outlined" label="Χωρίς γέφυρα" />;
                })()}
              </TableCell>
              <TableCell align="right">
                <Chip size="small" color={r.parameterItemCount > 0 ? "success" : "warning"} variant="outlined" label={r.parameterItemCount} />
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>{r.commissionDefaultCount}</TableCell>
              <TableCell align="right">
                {readonly ? (
                  // Ενταγμένη = tenant has ticked "Χρησιμοποιώ" (or created the
                  // row themselves). Διαθέσιμη = universal row still up for
                  // grabs. Sub-carriers inherit the broker's status silently
                  // — no chip so the row stays visually secondary.
                  r.parentCompanyId ? (
                    <Chip size="small" variant="outlined" label="Υπό πρακτορείο" sx={{ color: "text.secondary" }} />
                  ) : r.isUsedByTenant ? (
                    <Chip size="small" color="success" label="Ενταγμένη" sx={{ fontWeight: 700 }} />
                  ) : (
                    <Chip size="small" variant="outlined" label="Διαθέσιμη" sx={{ color: "text.secondary" }} />
                  )
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
