import { useEffect, useMemo, useState } from "react";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import BusinessIcon from "@mui/icons-material/Business";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AddIcon from "@mui/icons-material/Add";
import LayersClearIcon from "@mui/icons-material/LayersClear";
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

  // Opt-in toggle removed with the "Καθολικός κατάλογος" section — tenant-
  // owned carriers are implicitly used, so there's nothing for the operator
  // to tick.

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
  const usedGlobalGrouped = groupByBroker(usedGlobal);
  const ownTenantRows = allData.filter(c => !c.isGlobal);
  // Agencies see their own catalogue plus any legacy global carriers they had
  // already opted-in to (so existing policies keep resolving). Every other
  // Kalypsis-global row is intentionally hidden — new agencies never see them.
  const ownRows = [...ownTenantRows, ...usedGlobalGrouped];

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
          <Button
            variant="outlined"
            color="warning"
            onClick={() => {
              if (!confirm(
                "Καθαρισμός σβησμένων εταιρειών του γραφείου;\n\n" +
                "Θα διαγραφούν οριστικά οι σβησμένες εταιρείες που δεν έχουν κανένα συμβόλαιο συνδεδεμένο, μαζί με τις γέφυρες και τους κανόνες προμηθειών τους."
              )) return;
              void (async () => {
                try {
                  const r = await api.post<{ carriersDeleted: number; bridgesDeleted: number; commissionRulesDeleted: number; skipped: number }>("/insurance-companies/purge-soft-deleted");
                  setSuccess(
                    `Διαγράφηκαν οριστικά ${r.data.carriersDeleted} εταιρείες, ${r.data.bridgesDeleted} γέφυρες και ${r.data.commissionRulesDeleted} κανόνες προμηθειών.`
                    + (r.data.skipped > 0 ? ` Παραλείφθηκαν ${r.data.skipped} με ενεργά συμβόλαια.` : "")
                  );
                  void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
                } catch (e) {
                  setError(extractErrorMessage(e));
                }
              })();
            }}
          >
            Καθαρισμός σβησμένων
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Νέα ασφαλιστική
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>
        Δημιουργήστε τις δικές σας ασφαλιστικές και ορίστε δικά σας παραμετρικά (κλάδους / καλύψεις / χρήσεις / πακέτα).
        Οι γέφυρες συνδέουν raw κωδικούς κάθε εταιρείας με τα δικά σας παραμετρικά.
      </Alert>

      {q.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={3}>
          {/* Tenant-owned section — the only view agencies see. Legacy
              global-carrier rows are still returned by the API but rendered
              only when the tenant has opted-in to at least one; the rest of
              the platform catalogue is intentionally hidden — agencies work
              exclusively with their own catalogue now. */}
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
                Δεν υπάρχουν ασφαλιστικές ακόμη — πατήστε «Νέα ασφαλιστική» για να δημιουργήσετε την πρώτη.
              </Box>
            ) : (
              <CompanyTable rows={ownRows}
                onEdit={setEditing}
                onDelete={(id) => { if (confirm("Διαγραφή ασφαλιστικής;")) del.mutate(id); }}
                onClearRules={(id, count) => {
                  if (!confirm(`Καθαρισμός ${count} αυτόματων κανόνων προμηθειών από αυτή την εταιρεία;\n\nΘα διαγραφούν οριστικά. Οι δικοί σας κανόνες μπορούν να δημιουργηθούν εκ νέου από τη σελίδα Κανόνες Προμηθειών.`)) return;
                  void (async () => {
                    try {
                      const r = await api.post<{ rulesDeleted: number }>(`/insurance-companies/${id}/clear-commission-rules`);
                      setSuccess(`Διαγράφηκαν ${r.data.rulesDeleted} κανόνες προμηθειών.`);
                      void qc.invalidateQueries({ queryKey: ["insurance-companies"] });
                    } catch (e) { setError(extractErrorMessage(e)); }
                  })();
                }}
              />
            )}
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

function CompanyTable({ rows, onEdit, onDelete, readonly, onToggleOptIn, onClearRules }: {
  rows: CompanyDto[];
  onEdit?: (c: CompanyDto) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  // Only wired for the universal-catalog table — flips the tenant's opt-in.
  onToggleOptIn?: (id: string, enable: boolean) => void;
  /** Wipes commission rules attached to a carrier — one-shot cleanup for
   * rows the old auto-seed populated with ~2000 zero-percent scaffolding. */
  onClearRules?: (id: string, count: number) => void;
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
  // Client-side sort via the right-click header menu. Broker rows keep
  // their expansion state independent of the sort — we sort in-place then
  // still filter subs by expanded state.
  const [sortKey, setSortKey] = useState<keyof CompanyDto | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const arr = rows.slice();
    arr.sort((a, b) => {
      const va: any = a[sortKey] ?? "";
      const vb: any = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "el");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);
  const inferType = (key: string): ColumnType =>
    (key === "params" || key === "rules") ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof CompanyDto> = {
        code: "code", name: "name", agentCode: "agentCode",
        status: "isActive", params: "parameterItemCount", rules: "commissionDefaultCount",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      setSortKey(dtoKey);
      setSortDir(dir);
    },
  });
  const rowMenu = useRowContextMenu<CompanyDto>({
    entityLabel: "ασφαλιστικής",
    onEdit: onEdit ? (c) => onEdit(c) : undefined,
    onDelete: onDelete && !readonly ? (c) => { if (confirm("Διαγραφή;")) onDelete(c.id); } : undefined,
  });

  // Filter: sub rows are hidden unless their broker is expanded.
  const visibleRows = sortedRows.filter(r =>
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
            <TableCell sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "code", label: "Κωδικός", type: inferType("code"), canHide: false })}
            >Κωδικός</TableCell>
            <TableCell sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "name", label: "Όνομα", type: inferType("name"), canHide: false })}
            >Όνομα</TableCell>
            <TableCell sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "agentCode", label: "Κωδικός συνεργασίας", type: inferType("agentCode"), canHide: false })}
            >Κωδικός συνεργασίας</TableCell>
            <TableCell>Επικοινωνία</TableCell>
            <TableCell sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "status", label: "Κατάσταση", type: inferType("status"), canHide: false })}
            >Κατάσταση</TableCell>
            <TableCell>Γέφυρα</TableCell>
            <TableCell align="right" sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "params", label: "Παραμετρικά", type: inferType("params"), canHide: false })}
            >Παραμετρικά</TableCell>
            <TableCell align="right" sx={{ userSelect: "none" }}
              onContextMenu={(e) => headerMenu.open(e, { key: "rules", label: "Κανόνες", type: inferType("rules"), canHide: false })}
            >Κανόνες</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.map((r) => {
            const subCount = r.isBroker ? subCountByBroker.get(r.id) ?? 0 : 0;
            const expanded = expandedBrokerIds.has(r.id);
            return (
            <TableRow key={r.id} hover
              onContextMenu={(e) => rowMenu.open(e, r)}
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
                    {onClearRules && r.commissionDefaultCount > 0 && (
                      <Tooltip title={`Καθαρισμός των ${r.commissionDefaultCount} αυτόματων κανόνων`}>
                        <IconButton size="small" color="warning" onClick={() => onClearRules(r.id, r.commissionDefaultCount)}>
                          <LayersClearIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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
      {headerMenu.menu}
      {rowMenu.menu}
    </Box>
  );
}

function CompanyDialog({ open, onClose, item, onSaved }: {
  open: boolean; onClose: () => void; item: CompanyDto | null; onSaved: () => void;
}) {
  // A fresh carrier starts EMPTY: no auto-provisioned bridge, no zero-
  // commission scaffolding. The office builds its own parametrics, sets its
  // own commission rules, and links the raw bridge codes via
  // BridgeCodeMappings on first import.
  const [form, setForm] = useState<UpsertBody>({
    name: "", code: "", country: "Ελλάδα", website: null, isActive: true,
    agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
    afmVat: null, notes: null,
    createBridge: false,
    bridgeName: null,
    bridgeAutoSync: false,
    bridgeConfigJson: null,
    installZeroCommissionDefaults: false
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, code: item.code, country: item.country, website: item.website, isActive: item.isActive,
        agentCode: item.agentCode, contactName: item.contactName, contactEmail: item.contactEmail,
        contactPhone: item.contactPhone, afmVat: item.afmVat, notes: item.notes,
        createBridge: false,
        bridgeName: null,
        bridgeAutoSync: false,
        bridgeConfigJson: null,
        installZeroCommissionDefaults: false
      });
    } else if (open) {
      setForm({
        name: "", code: "", country: "Ελλάδα", website: null, isActive: true,
        agentCode: null, contactName: null, contactEmail: null, contactPhone: null,
        afmVat: null, notes: null,
        createBridge: false,
        bridgeName: null,
        bridgeAutoSync: false,
        bridgeConfigJson: null,
        installZeroCommissionDefaults: false
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
