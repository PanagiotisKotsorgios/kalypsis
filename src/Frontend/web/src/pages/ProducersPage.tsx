import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { InputAdornment, Fade, Slide, Divider, alpha } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import LinkIcon from "@mui/icons-material/Link";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { CredentialsDialog } from "./TenantsPage";
import { ProducerDetailDrawer } from "../components/ProducerDetailDrawer";
import { ProducerCustomersDialog } from "../components/ProducerCustomersDialog";
import { ReassignProducerDialog } from "../components/ReassignProducerDialog";
import PeopleIcon from "@mui/icons-material/People";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useTableState } from "../components/useTableState";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { SearchableTextField } from "../components/SearchableTextField";
import { SearchableSelect } from "../components/SearchableSelect";

type ProducerStatus = "Active" | "Suspended" | "Terminated";
type ProducerTier = "None" | "A" | "B" | "C" | "D" | "E";

type HierarchyLevel = "Producer" | "Manager" | "Unit" | "Assistant" | "Agency";

const HIERARCHY_LABEL: Record<HierarchyLevel, string> = {
  Producer:  "Παραγωγός (πωλητής)",
  Manager:   "Προϊστάμενος ομάδας",
  Unit:      "Υπεύθυνος μονάδας",
  Assistant: "Βοηθός διοίκησης",
  Agency:    "Γραφείο (κεντρικό)"
};

// One-line explanation shown next to each option so the operator knows
// exactly what each level means — the English terms (Manager / Unit /
// Assistant) come from ALIS parity and are opaque without context.
const HIERARCHY_DESC: Record<HierarchyLevel, string> = {
  Producer:  "Ο συνεργάτης που φέρνει το συμβόλαιο. Είναι το πρώτο επίπεδο προμήθειας.",
  Manager:   "Προϊστάμενος μιας ομάδας παραγωγών. Παίρνει ένα ποσοστό από κάθε συμβόλαιο των παραγωγών του.",
  Unit:      "Επικεφαλής μιας μονάδας από ομάδες. Παίρνει ποσοστό πάνω από τον Προϊστάμενο ομάδας.",
  Assistant: "Βοηθός διοίκησης πάνω από τη μονάδα. Παίρνει ένα μικρό ποσοστό συντονισμού.",
  Agency:    "Το ίδιο το γραφείο. Είναι η κορυφή της ιεραρχίας — παίρνει ό,τι μένει μετά όλες τις προμήθειες."
};

interface ProducerDto {
  id: string; code: string; name: string;
  email: string | null; phone: string | null;
  status: ProducerStatus; tier: ProducerTier;
  policyCount: number; createdAt: string;
  // ALIS-parity hierarchy
  hierarchyLevel: HierarchyLevel;
  parentProducerId: string | null;
  parentProducerName: string | null;
}

const STATUS_COLOR: Record<ProducerStatus, "success" | "warning" | "default"> = {
  Active: "success", Suspended: "warning", Terminated: "default"
};
const TIER_COLOR: Record<ProducerTier, "default" | "warning" | "primary" | "info" | "success"> = {
  A: "warning", B: "primary", C: "info", D: "success", E: "default", None: "default"
};
const TIER_LABEL: Record<ProducerTier, string> = {
  A: "Κατ. Α", B: "Κατ. Β", C: "Κατ. Γ", D: "Κατ. Δ", E: "Κατ. Ε", None: "—"
};

export function ProducersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProducerDto | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [customersFor, setCustomersFor] = useState<ProducerDto | null>(null);
  const [reassignFor, setReassignFor] = useState<ProducerDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuedCreds, setIssuedCreds] = useState<{ email: string; password: string } | null>(null);

  const q = useQuery({
    queryKey: ["producers"],
    queryFn: async () => (await api.get<ProducerDto[]>("/producers")).data
  });

  const issuePortal = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ email: string; temporaryPassword: string }>(`/producers/${id}/portal-account`, {})).data,
    onSuccess: (data) => setIssuedCreds({ email: data.email, password: data.temporaryPassword }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["producers"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [statusFilter, setStatusFilter] = useState<ProducerStatus | "">("");
  const [tierFilter, setTierFilter] = useState<ProducerTier | "">("");
  const [hasPoliciesOnly, setHasPoliciesOnly] = useState(false);
  const rawProducers = q.data ?? [];
  const allRows = rawProducers.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (tierFilter && p.tier !== tierFilter) return false;
    if (hasPoliciesOnly && p.policyCount === 0) return false;
    return true;
  });
  const table = useTableState<ProducerDto>({
    rows: allRows,
    searchableText: (p) => `${p.code} ${p.name} ${p.email ?? ""} ${p.phone ?? ""} ${p.status}`,
    pageSize: 25
  });
  const rows = table.paged;

  // Right-click on a header → sort by that column. Row menu → edit / delete.
  const inferType = (key: string): ColumnType => key === "policies" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ProducerDto> = {
        code: "code", name: "name", tier: "tier",
        email: "email", phone: "phone", policies: "policyCount", status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
  });
  const rowMenu = useRowContextMenu<ProducerDto>({
    entityLabel: "παραγωγού",
    onEdit: (p) => setEditing(p),
    onDelete: (p) => { if (confirm(t("producers.confirmDelete", { name: p.name }))) del.mutate(p.id); },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("producers.title")}</Typography>
            <HelpHint id="page.producers" />
          </Stack>
          <Typography color="text.secondary">{t("producers.subtitle")}</Typography>
        </Box>
        <Button data-tour="producers-new" variant="contained" size="large" startIcon={<AddIcon />} onClick={() => { setError(null); setCreateOpen(true); }}>
          {t("producers.create")}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ px: 1.5, py: 1.25, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
          <FilterFieldWrap tip="Φιλτράρετε τους συνεργάτες ανά κατάσταση (Ενεργός, Ανενεργός, Τερματισμένος).">
            <SearchableTextField size="small" label={t("producers.col.status")}
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProducerStatus | "")}
              sx={{ minWidth: 170, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {(["Active","Suspended","Terminated"] as const).map(s =>
                <MenuItem key={s} value={s}>{t(`producers.statuses.${s}`)}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε ανά κατηγορία προμηθειών Α/Β/Γ/Δ/Ε ή «Χωρίς κατηγορία».">
            <SearchableTextField size="small" label="Κατηγορία"
              value={tierFilter} onChange={(e) => setTierFilter(e.target.value as ProducerTier | "")}
              sx={{ minWidth: 150, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {(["A","B","C","D","E"] as const).map(t =>
                <MenuItem key={t} value={t}>{TIER_LABEL[t as ProducerTier]}</MenuItem>)}
              <MenuItem value="None">Χωρίς κατηγορία</MenuItem>
            </SearchableTextField>
          </FilterFieldWrap>
          <Stack direction="row" alignItems="center" spacing={1}>
            <input type="checkbox" id="has-policies-only" checked={hasPoliciesOnly}
              onChange={(e) => setHasPoliciesOnly(e.target.checked)} />
            <Box component="label" htmlFor="has-policies-only" sx={{ fontSize: 14, cursor: "pointer" }}>
              Μόνο με συμβόλαια
            </Box>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => { setStatusFilter(""); setTierFilter(""); setHasPoliciesOnly(false); }}>
            Καθαρισμός
          </Button>
        </Stack>
      </Card>

      <Box sx={{ mb: 2 }}>
        <TableToolbar<ProducerDto>
          query={table.query} onQuery={table.setQuery}
          count={allRows.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`producers-${new Date().toISOString().slice(0, 10)}`}
          serverEntity="producers"
          serverParams={{ search: table.query }}
          exportColumns={[
            { key: "code", label: "Κωδικός" },
            { key: "name", label: "Όνομα" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Τηλέφωνο" },
            { key: "status", label: "Κατάσταση" },
            { key: "policyCount", label: "Συμβόλαια" }
          ]}
        />
      </Box>
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "code", label: t("producers.col.code"), type: inferType("code"), canHide: false })}
                  >{t("producers.col.code")}</TableCell>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "name", label: t("producers.col.name"), type: inferType("name"), canHide: false })}
                  >{t("producers.col.name")}</TableCell>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "tier", label: "Κατηγορία", type: inferType("tier"), canHide: false })}
                  >Κατηγορία</TableCell>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "email", label: t("producers.col.email"), type: inferType("email"), canHide: false })}
                  >{t("producers.col.email")}</TableCell>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "phone", label: t("producers.col.phone"), type: inferType("phone"), canHide: false })}
                  >{t("producers.col.phone")}</TableCell>
                  <TableCell align="right" sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "policies", label: t("producers.col.policies"), type: inferType("policies"), canHide: false })}
                  >{t("producers.col.policies")}</TableCell>
                  <TableCell sx={{ userSelect: "none" }}
                    onContextMenu={(e) => headerMenu.open(e, { key: "status", label: t("producers.col.status"), type: inferType("status"), canHide: false })}
                  >{t("producers.col.status")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p, idx) => (
                  <TableRow key={p.id} hover sx={{ cursor: "pointer" }}
                    data-tour={idx === 0 ? "producers-row" : undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root")) return;
                      setDetailId(p.id);
                    }}
                    onContextMenu={(e) => rowMenu.open(e, p)}>
                    <TableCell><Chip label={p.code} size="small" variant="outlined" /></TableCell>
                    <TableCell><Typography fontWeight={600}>{p.name}</Typography></TableCell>
                    <TableCell>
                      {p.tier && p.tier !== "None"
                        ? <Chip size="small" color={TIER_COLOR[p.tier]} label={TIER_LABEL[p.tier]} sx={{ fontWeight: 800 }} />
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell align="right">{p.policyCount}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[p.status]} label={t(`producers.statuses.${p.status}`)} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" title="Πελάτες συνεργάτη"
                          onClick={(e) => { e.stopPropagation(); setCustomersFor(p); }}>
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title="Μετακίνηση σε άλλον συνεργάτη"
                          onClick={(e) => { e.stopPropagation(); setReassignFor(p); }}>
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" title={t("producers.issuePortal")}
                          disabled={!p.email || p.status !== "Active" || issuePortal.isPending}
                          onClick={() => issuePortal.mutate(p.id)}>
                          <VpnKeyIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setEditing(p)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => { if (confirm(t("producers.confirmDelete", { name: p.name }))) del.mutate(p.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7}>
                    <Typography textAlign="center" color="text.secondary" py={4}>{t("producers.empty")}</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      <ProducerDialog
        open={createOpen} onClose={() => setCreateOpen(false)} producer={null}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setCreateOpen(false); }}
      />
      <ProducerDialog
        open={!!editing} onClose={() => setEditing(null)} producer={editing}
        onSaved={() => { void qc.invalidateQueries({ queryKey: ["producers"] }); setEditing(null); }}
      />

      <CredentialsDialog
        open={!!issuedCreds}
        email={issuedCreds?.email ?? ""}
        password={issuedCreds?.password ?? ""}
        onClose={() => setIssuedCreds(null)}
        title={t("producers.portalCreated")}
        introKey="producers.portalCreatedBody"
      />

      <ProducerDetailDrawer
        producerId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />

      <ProducerCustomersDialog
        open={!!customersFor}
        onClose={() => setCustomersFor(null)}
        producerId={customersFor?.id ?? null}
        producerName={customersFor?.name}
      />

      <ReassignProducerDialog
        open={!!reassignFor}
        onClose={() => setReassignFor(null)}
        fromProducer={reassignFor}
      />
    </Box>
  );
}

interface UserLookupDto {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  linkedProducerId: string | null;
  linkedProducerCode: string | null;
  linkedProducerName: string | null;
}

function ProducerDialog({ open, onClose, producer, onSaved }: {
  open: boolean; onClose: () => void; producer: ProducerDto | null; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!producer;
  const [form, setForm] = useState({
    code: "", name: "", email: "", phone: "",
    status: "Active" as ProducerStatus,
    tier: "None" as ProducerTier,
    hierarchyLevel: "Producer" as HierarchyLevel,
    parentProducerId: "" as string
  });
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // Load the tenant's producer list so we can offer parents in a searchable
  // dropdown. Excludes the current producer (no self-parent) and defers to
  // the calculator for deeper cycles.
  const producersQ = useQuery({
    queryKey: ["producers-for-hierarchy"],
    enabled: open,
    queryFn: async () => (await api.get<ProducerDto[]>("/producers")).data
  });
  const parentOptions = useMemo(() => {
    const all = producersQ.data ?? [];
    return all.filter(p => !producer || p.id !== producer.id);
  }, [producersQ.data, producer]);

  useEffect(() => {
    if (producer) {
      setForm({
        code: producer.code, name: producer.name,
        email: producer.email ?? "", phone: producer.phone ?? "",
        status: producer.status, tier: producer.tier ?? "None",
        hierarchyLevel: producer.hierarchyLevel ?? "Producer",
        parentProducerId: producer.parentProducerId ?? ""
      });
    } else if (open) {
      setForm({ code: "", name: "", email: "", phone: "", status: "Active", tier: "None",
        hierarchyLevel: "Producer", parentProducerId: "" });
    }
  }, [producer, open]);

  // Debounce the email as the operator types → live lookup against Kalypsis
  // users. Only enable when the string looks like a plausible email and the
  // dialog is open, so we don't burn queries while the field is empty.
  const [debouncedEmail, setDebouncedEmail] = useState("");
  useEffect(() => {
    const trimmed = form.email.trim().toLowerCase();
    const handle = setTimeout(() => setDebouncedEmail(trimmed), 400);
    return () => clearTimeout(handle);
  }, [form.email]);

  const lookup = useQuery({
    queryKey: ["producer-user-lookup", debouncedEmail],
    queryFn: async () => (await api.get<UserLookupDto | null>("/producers/user-lookup", {
      params: { email: debouncedEmail }
    })).data,
    enabled: open && debouncedEmail.length > 3 && debouncedEmail.includes("@") && debouncedEmail.includes("."),
    staleTime: 30_000,
  });

  // Three visual states for the lookup: searching (spinner + wait), found (green
  // check + «click to verify»), not-found (blue info hint). The check icon has a
  // scale-in animation via MUI's Fade so it feels alive when a hit lands.
  const searching = lookup.isFetching;
  const foundUser = lookup.data ?? null;
  const notFound = !searching && debouncedEmail.length > 3 && lookup.isFetched && !foundUser;

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, parentProducerId: form.parentProducerId || null };
      if (editing) return (await api.put(`/producers/${producer!.id}`, body)).data;
      return (await api.post("/producers", body)).data;
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <>
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? t("producers.form.editTitle") : t("producers.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          {/* Κωδικός is short (≤8 chars), Κατάσταση carries longer localised
              labels — give status ~2× the width so «Τερματισμένος» never
              gets clipped and Κωδικός stops swallowing empty space. */}
          <Stack direction="row" spacing={2}>
            <TextField label={t("producers.col.code")} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={editing}
              sx={{ flex: 1 }}
              InputProps={{ endAdornment: <FilterHelp title="Μοναδικός κωδικός συνεργάτη. Δεν αλλάζει μετά τη δημιουργία — χρησιμοποιείται σε bridges και reports." /> }} />
            <FilterFieldWrap tip="Ενεργός: εμφανίζεται και δουλεύει κανονικά. Ανενεργός/Τερματισμένος: κρύβεται από τις νέες αναθέσεις." sx={{ flex: 2 }}>
              <SearchableTextField label={t("producers.col.status")} value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProducerStatus })} fullWidth>
                {(["Active","Suspended","Terminated"] as const).map(s => <MenuItem key={s} value={s}>{t(`producers.statuses.${s}`)}</MenuItem>)}
              </SearchableTextField>
            </FilterFieldWrap>
          </Stack>
          <FilterFieldWrap tip="Επιλέξτε την κατηγορία Α/Β/Γ/Δ/Ε ώστε ο συνεργάτης να παίρνει αυτόματα την προμήθεια που έχετε ορίσει στην παραμετροποίηση για την κατηγορία του.">
            <SearchableTextField label="Κατηγορία προμηθειών" value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value as ProducerTier })} fullWidth>
              <MenuItem value="None">— Χωρίς κατηγορία —</MenuItem>
              {(["A","B","C","D","E"] as const).map(tier =>
                <MenuItem key={tier} value={tier}>{TIER_LABEL[tier as ProducerTier]}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          {/* ALIS-parity hierarchy — determines who gets paid at each level of
              the commission matrix. Leaf sales agents keep the default
              "Παραγωγός" level; supervisors move up the chain. The Alert
              below primes the operator on what each rank actually means so
              they aren't guessing between «Manager» / «Unit» / «Assistant». */}
          <Alert severity="info" variant="outlined" sx={{ mb: -1 }}>
            <b>Πώς δουλεύει η ιεραρχία:</b> Κάθε συμβόλαιο πληρώνει τον <i>Παραγωγό</i> που το φέρνει.
            Ένα κομμάτι της προμήθειας ανεβαίνει και στον <i>Προϊστάμενο ομάδας</i>, μετά στον <i>Υπεύθυνο μονάδας</i>,
            μετά στον <i>Βοηθό διοίκησης</i>, και ό,τι μένει πάει στο <i>Γραφείο</i>.
            Αν αυτός ο συνεργάτης είναι στην κορυφή της ιεραρχίας του, αφήστε το «Προϊστάμενος» → <i>Ίδιος</i>.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FilterFieldWrap tip="Θέση στην ιεραρχία προμηθειών. Ένας απλός Παραγωγός έχει έναν Προϊστάμενο ομάδας ως γονέα, εκείνος έναν Υπεύθυνο μονάδας, κ.ο.κ." sx={{ flex: 2 }}>
              <SearchableSelect
                label="Επίπεδο ιεραρχίας"
                value={form.hierarchyLevel}
                onChange={(v) => setForm({ ...form, hierarchyLevel: v as HierarchyLevel })}
                sx={{ width: "100%" }}
                options={(["Producer","Manager","Unit","Assistant","Agency"] as const).map(lvl => ({
                  value: lvl,
                  label: HIERARCHY_LABEL[lvl],
                  hint: HIERARCHY_DESC[lvl],
                }))}
                helperText={HIERARCHY_DESC[form.hierarchyLevel]} />
            </FilterFieldWrap>
            <Box sx={{ flex: 1 }}>
              <SearchableSelect
                label="Προϊστάμενος"
                value={form.parentProducerId}
                onChange={(v) => setForm({ ...form, parentProducerId: v })}
                emptyLabel="Ίδιος (κορυφή ιεραρχίας)"
                sx={{ width: "100%" }}
                options={parentOptions.map(p => ({
                  value: p.id, label: p.name,
                  hint: HIERARCHY_LABEL[p.hierarchyLevel ?? "Producer"]
                }))}
                helperText="Ο συνεργάτης που παίρνει προμήθεια από πάνω. Αφήστε «Ίδιος» αν αυτός είναι το ανώτερο επίπεδο." />
            </Box>
          </Stack>
          <TextField label={t("producers.col.name")} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth required
            InputProps={{ endAdornment: <FilterHelp title="Πλήρες ονοματεπώνυμο συνεργάτη όπως εμφανίζεται σε λίστες, έγγραφα και reports." /> }} />
          <Box>
            <TextField
              label={t("producers.col.email")}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {searching && <CircularProgress size={18} thickness={5} />}
                    <Fade in={!searching && !!foundUser} unmountOnExit>
                      <IconButton size="small" onClick={() => setVerifyOpen(true)} color="success" title="Βρέθηκε χρήστης στο Kalypsis">
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Fade>
                    <Fade in={notFound} unmountOnExit>
                      <PersonSearchIcon fontSize="small" color="disabled" />
                    </Fade>
                  </InputAdornment>
                )
              }}
            />
            <Slide direction="down" in={!searching && !!foundUser} mountOnEnter unmountOnExit>
              <Alert
                icon={<CheckCircleIcon fontSize="inherit" />}
                severity="success"
                sx={{ mt: 1, cursor: "pointer" }}
                onClick={() => setVerifyOpen(true)}
                action={<Button size="small" onClick={() => setVerifyOpen(true)}>Επαλήθευση</Button>}
              >
                Βρέθηκε χρήστης στο Kalypsis — <b>{foundUser?.fullName || foundUser?.email}</b>. Επαληθεύστε τα στοιχεία πριν από τη σύνδεση.
              </Alert>
            </Slide>
            <Slide direction="down" in={notFound} mountOnEnter unmountOnExit>
              <Alert severity="info" sx={{ mt: 1 }} icon={<HelpOutlineIcon fontSize="inherit" />}>
                Ο χρήστης δεν είναι εγγεγραμμένος στο Kalypsis. Θα δημιουργηθεί λογαριασμός portal για αυτόν κατά την αποθήκευση.
                Όταν κάνει εγγραφή, μπορείτε να τον συνδέσετε ξανά μέσω «Επεξεργασία» βάζοντας το email του εδώ.
              </Alert>
            </Slide>
          </Box>
          <TextField label={t("producers.col.phone")} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Τηλέφωνο επικοινωνίας. Χρησιμοποιείται για CRM δραστηριότητες όπως τηλεφωνήματα και SMS." /> }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim() || !form.name.trim()}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
    <VerifyUserDialog open={verifyOpen} user={foundUser} onClose={() => setVerifyOpen(false)} />
    </>
  );
}

// Verification popup shown when the operator confirms the found User is the
// intended person. Backend already does the linking on save (existing email →
// User.ProducerId), so this dialog is informational — it exists so the operator
// can eyeball name/role/linked producer and back out if it's the wrong person.
function VerifyUserDialog({ open, user, onClose }: {
  open: boolean; user: UserLookupDto | null; onClose: () => void;
}) {
  if (!user) return <Dialog open={open} onClose={onClose} />;
  const alreadyLinked = !!user.linkedProducerId;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CheckCircleIcon color="success" />
          <span>Επαλήθευση χρήστη Kalypsis</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: (th) => alpha(th.palette.success.main, 0.05) }}>
          <Stack spacing={1}>
            <VerifyRow label="Όνομα" value={user.fullName || "—"} />
            <VerifyRow label="Email" value={user.email} mono />
            <VerifyRow label="Ρόλος" value={user.role} />
            <VerifyRow label="Ενεργός" value={user.isActive ? "Ναι" : "Όχι"} />
            <VerifyRow label="Εγγραφή" value={new Date(user.createdAt).toLocaleDateString("el-GR")} />
            <Divider />
            {alreadyLinked ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon fontSize="small" color="warning" />
                <Typography variant="body2">
                  Ο χρήστης είναι <b>ήδη συνδεδεμένος</b> με τον παραγωγό
                  {" "}<b>{user.linkedProducerCode} — {user.linkedProducerName}</b>.
                  Η αποθήκευση θα επαναφέρει τη σύνδεση σε αυτόν τον παραγωγό.
                </Typography>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon fontSize="small" color="success" />
                <Typography variant="body2">
                  Ο χρήστης δεν έχει σύνδεση με παραγωγό. Θα συνδεθεί αυτόματα με τη νέα εγγραφή στην αποθήκευση.
                </Typography>
              </Stack>
            )}
          </Stack>
        </Card>
        <Typography variant="caption" color="text.secondary">
          Αν <b>δεν είναι το ίδιο πρόσωπο</b>, αλλάξτε το email — δεν θα γίνει σύνδεση.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Εντάξει</Button>
      </DialogActions>
    </Dialog>
  );
}

function VerifyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={2} alignItems="baseline">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={mono ? { fontFamily: "monospace" } : undefined}>
        {value}
      </Typography>
    </Stack>
  );
}
