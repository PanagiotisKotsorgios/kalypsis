import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { money, date } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { ClaimDetailDrawer } from "../components/ClaimDetailDrawer";
import { useTableState } from "../components/useTableState";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { SearchableSelect } from "../components/SearchableSelect";
import { useCarrierCatalogue } from "../hooks/useCarrierCatalogue";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type ClaimStatus = "Reported" | "UnderReview" | "Approved" | "Rejected" | "Paid" | "Closed";

interface ClaimDto {
  id: string;
  claimNumber: string;
  policyId: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  policyType: PolicyType;
  insuranceCompanyName: string;
  insuranceCompanyId: string | null;
  vehicleUseCategory: string | null;
  coverCode: string | null;
  packageCode: string | null;
  incidentDate: string;
  reportedDate: string;
  status: ClaimStatus;
  claimedAmount: number | null;
  approvedAmount: number | null;
  description: string | null;
  createdAt: string;
}

interface PolicyLite {
  id: string;
  policyNumber: string;
  customerDisplay: string;
  policyType: PolicyType;
  insuranceCompanyName: string;
}

function useMemoAllowed(
  allCarriers: { id: string; name: string; parentCompanyId?: string | null }[],
  carrierId: string,
  subIds: string[]
) {
  return useMemo(() => {
    const out = new Set<string>();
    if (!carrierId) return out;
    if (subIds.length > 0) {
      for (const id of subIds) {
        const c = allCarriers.find(x => x.id === id);
        if (c) out.add(c.name);
      }
      return out;
    }
    const top = allCarriers.find(x => x.id === carrierId);
    if (top) out.add(top.name);
    for (const c of allCarriers) {
      if (c.parentCompanyId === carrierId) out.add(c.name);
    }
    return out;
  }, [allCarriers, carrierId, subIds]);
}

const STATUS_COLOR: Record<ClaimStatus, "default" | "info" | "warning" | "success" | "error"> = {
  Reported: "info",
  UnderReview: "warning",
  Approved: "success",
  Rejected: "error",
  Paid: "success",
  Closed: "default"
};

export function ClaimsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCustomer = user?.role === "Customer";
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyUser";

  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClaimDto | null>(null);
  const [detail, setDetail] = useState<ClaimDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [carrierFilter,  setCarrierFilter]  = useState(""); // carrier ID now
  const [subCarrierFilter, setSubCarrierFilter] = useState<string[]>([]);
  const [typeFilter,     setTypeFilter]     = useState("");
  const [useFilter,      setUseFilter]      = useState("");
  const [coverFilter,    setCoverFilter]    = useState("");
  const [packageFilter,  setPackageFilter]  = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate,   setToDate]   = useState("");

  const carriersQ = useQuery({
    queryKey: ["carriers-claims-filter"],
    queryFn: async () => (await api.get<{ id: string; name: string; isBroker?: boolean; parentCompanyId?: string | null }[]>(
      "/insurance-companies")).data
  });
  const filterCatalogue = useCarrierCatalogue(carrierFilter, subCarrierFilter);

  const claimsQuery = useQuery({
    queryKey: ["claims", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      return (await api.get<ClaimDto[]>("/claims", { params })).data;
    }
  });

  const rawClaims = claimsQuery.data ?? [];
  const allCarriers = carriersQ.data ?? [];
  const allowedIds = useMemo(() => {
    const out = new Set<string>();
    if (!carrierFilter) return out;
    if (subCarrierFilter.length > 0) {
      for (const id of subCarrierFilter) out.add(id);
      return out;
    }
    out.add(carrierFilter);
    for (const c of allCarriers) if (c.parentCompanyId === carrierFilter) out.add(c.id);
    return out;
  }, [allCarriers, carrierFilter, subCarrierFilter]);
  const allowedNames = useMemoAllowed(allCarriers, carrierFilter, subCarrierFilter);

  const allClaims = rawClaims.filter(c => {
    if (carrierFilter) {
      // Prefer the new InsuranceCompanyId field; fall back to name matching
      // for any legacy rows the API hasn't populated yet.
      if (c.insuranceCompanyId
          ? !allowedIds.has(c.insuranceCompanyId)
          : !allowedNames.has(c.insuranceCompanyName)) return false;
    }
    if (typeFilter && c.policyType !== typeFilter) return false;
    if (useFilter && c.vehicleUseCategory !== useFilter) return false;
    if (coverFilter && c.coverCode !== coverFilter) return false;
    if (packageFilter && c.packageCode !== packageFilter) return false;
    if (customerFilter) {
      const f = customerFilter.toLowerCase();
      const hay = `${c.customerDisplay ?? ""} ${c.policyNumber ?? ""}`.toLowerCase();
      if (!hay.includes(f)) return false;
    }
    if (fromDate && c.incidentDate < fromDate) return false;
    if (toDate   && c.incidentDate > toDate)   return false;
    return true;
  });
  const table = useTableState<ClaimDto>({
    rows: allClaims,
    searchableText: (c) => `${c.claimNumber} ${c.policyNumber} ${c.customerDisplay} ${c.insuranceCompanyName} ${c.policyType} ${c.status} ${c.description ?? ""}`,
    pageSize: 25,
    initialSortKey: "createdAt" as keyof ClaimDto,
    initialSortDir: "desc"
  });
  const rows = table.paged;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isCustomer ? t("claims.customerTitle") : t("claims.agencyTitle")}
            </Typography>
            <HelpHint id="page.claims" />
          </Stack>
          <Typography color="text.secondary">
            {isCustomer ? t("claims.customerLead") : t("claims.agencyLead")}
          </Typography>
        </Box>
        {canEdit && (
          <Button data-tour="claims-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateOpen(true); }}>
            {t("claims.create")}
          </Button>
        )}
      </Stack>

      {!isCustomer && (
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField select size="small" label={t("claims.col.status")}
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "")}
              sx={{ minWidth: 180 }}>
              <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
              {(["Reported","UnderReview","Approved","Rejected","Paid","Closed"] as const).map(s =>
                <MenuItem key={s} value={s}>{t(`claims.statuses.${s}`)}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Πελάτης / Συμβόλαιο / ΑΦΜ" placeholder="…αναζήτηση…"
              value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
              sx={{ minWidth: 260 }} />
            <SearchableSelect
              label="Εταιρία"
              value={carrierFilter}
              onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); setUseFilter(""); setCoverFilter(""); setPackageFilter(""); }}
              emptyLabel="Όλες"
              sx={{ minWidth: 220 }}
              options={(carriersQ.data ?? []).filter(c => !c.parentCompanyId).map(c => ({
                value: c.id, label: c.name, hint: c.isBroker ? "πρακτορείο" : undefined,
              }))}
            />
            <SearchableSelect
              label="Κλάδος"
              value={typeFilter} onChange={(v) => setTypeFilter(v)}
              disabled={!carrierFilter}
              helperText={!carrierFilter
                ? "Επιλέξτε εταιρία"
                : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="Όλοι"
              sx={{ minWidth: 220 }}
              options={filterCatalogue.branches.map(b => ({ value: b.value, label: b.label }))}
            />
            <SearchableSelect
              label="Χρήση οχήματος"
              value={useFilter} onChange={(v) => setUseFilter(v)}
              disabled={!carrierFilter}
              helperText={!carrierFilter
                ? "Επιλέξτε εταιρία"
                : filterCatalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="Όλες"
              sx={{ minWidth: 220 }}
              options={filterCatalogue.uses.map(u => ({ value: u.value, label: u.label }))}
            />
            <SearchableSelect
              label="Κάλυψη"
              value={coverFilter} onChange={(v) => setCoverFilter(v)}
              disabled={!carrierFilter}
              helperText={!carrierFilter
                ? "Επιλέξτε εταιρία"
                : filterCatalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="Όλες"
              sx={{ minWidth: 220 }}
              options={filterCatalogue.coverages.map(c => ({ value: c.value, label: c.label }))}
            />
            <SearchableSelect
              label="Πακέτο"
              value={packageFilter} onChange={(v) => setPackageFilter(v)}
              disabled={!carrierFilter}
              helperText={!carrierFilter
                ? "Επιλέξτε εταιρία"
                : filterCatalogue.packages.length === 0 ? "Δεν υπάρχουν πακέτα" : ""}
              emptyLabel="Όλα"
              sx={{ minWidth: 220 }}
              options={filterCatalogue.packages.map(p => ({ value: p.value, label: p.label }))}
            />
            <TextField size="small" type="date" label="Συμβάν από" InputLabelProps={{ shrink: true }}
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <TextField size="small" type="date" label="Συμβάν έως" InputLabelProps={{ shrink: true }}
              value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Button size="small" onClick={() => {
              setStatusFilter(""); setCustomerFilter(""); setCarrierFilter(""); setSubCarrierFilter([]);
              setTypeFilter(""); setUseFilter(""); setCoverFilter(""); setPackageFilter("");
              setFromDate(""); setToDate("");
            }}>Καθαρισμός</Button>
          </Stack>
        </Card>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <TableToolbar<ClaimDto>
          query={table.query} onQuery={table.setQuery}
          count={allClaims.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`claims-${new Date().toISOString().slice(0, 10)}`}
          serverEntity="claims"
          serverParams={{ search: table.query }}
          exportColumns={[
            { key: "claimNumber", label: "Αρ. Ζημιάς" },
            { key: "policyNumber", label: "Αρ. Συμβ." },
            { key: "customerDisplay", label: "Πελάτης" },
            { key: "insuranceCompanyName", label: "Εταιρία" },
            { key: "policyType", label: "Κλάδος" },
            { key: "incidentDate", label: "Ημ. ατυχήματος" },
            { key: "reportedDate", label: "Δηλώθηκε" },
            { key: "status", label: "Κατάσταση" },
            { key: "claimedAmount", label: "Αιτηθέν" },
            { key: "approvedAmount", label: "Εγκριθέν" }
          ]}
        />
      </Box>
      {claimsQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("claims.col.number")}</TableCell>
                  <TableCell>{t("claims.col.policy")}</TableCell>
                  {!isCustomer && <TableCell>{t("claims.col.customer")}</TableCell>}
                  <TableCell>{t("claims.col.incidentDate")}</TableCell>
                  <TableCell align="right">{t("claims.col.claimed")}</TableCell>
                  <TableCell align="right">{t("claims.col.approved")}</TableCell>
                  <TableCell>{t("claims.col.status")}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((c, idx) => (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }}
                    data-tour={idx === 0 ? "claims-row" : undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root")) return;
                      setDetail(c);
                    }}>
                    <TableCell><Chip data-tour={idx === 0 ? "claims-status" : undefined} label={c.claimNumber} variant="outlined" size="small" /></TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{c.policyNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`policies.types.${c.policyType}`)} · {c.insuranceCompanyName}
                      </Typography>
                    </TableCell>
                    {!isCustomer && <TableCell>{c.customerDisplay}</TableCell>}
                    <TableCell>{date(c.incidentDate)}</TableCell>
                    <TableCell align="right">{c.claimedAmount != null ? money(c.claimedAmount) : "—"}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={c.approvedAmount != null ? 700 : 400}>
                        {c.approvedAmount != null ? money(c.approvedAmount) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={t(`claims.statuses.${c.status}`)} color={STATUS_COLOR[c.status]} size="small" />
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => setEditing(c)} title={t("common.edit")}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : isCustomer ? 6 : 7}>
                      <Typography color="text.secondary" textAlign="center" py={4}>
                        {t("claims.noClaims")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} />
          </Box>
        </Card>
      )}

      {canEdit && (
        <>
          <CreateClaimDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["claims"] }); setCreateOpen(false); }}
          />
          <EditClaimDialog
            claim={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["claims"] }); setEditing(null); }}
          />
        </>
      )}
      <ClaimDetailDrawer claim={detail as any} open={!!detail} onClose={() => setDetail(null)} />
    </Box>
  );
}

/* ====================== Create dialog ====================== */

function CreateClaimDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const policiesQuery = useQuery({
    queryKey: ["policies", "all-for-claim"],
    queryFn: async () => (await api.get<PolicyLite[]>("/policies")).data,
    enabled: open
  });

  const [form, setForm] = useState({
    policyId: "",
    incidentDate: new Date().toISOString().slice(0, 10),
    claimedAmount: 0,
    description: ""
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        policyId: "",
        incidentDate: new Date().toISOString().slice(0, 10),
        claimedAmount: 0,
        description: ""
      });
    }
  }, [open]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.post<ClaimDto>("/claims", {
        policyId: form.policyId,
        incidentDate: form.incidentDate,
        reportedDate: new Date().toISOString().slice(0, 10),
        claimedAmount: form.claimedAmount > 0 ? form.claimedAmount : null,
        description: form.description.trim() || null
      })).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("claims.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField
            select required fullWidth
            label={t("claims.form.policy")}
            value={form.policyId}
            onChange={(e) => setForm({ ...form, policyId: e.target.value })}
          >
            {(policiesQuery.data ?? []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.policyNumber} · {t(`policies.types.${p.policyType}`)} · {p.customerDisplay} · {p.insuranceCompanyName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date" label={t("claims.form.incidentDate")}
            InputLabelProps={{ shrink: true }} value={form.incidentDate}
            onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
            fullWidth required
          />
          <TextField
            type="number" label={t("claims.form.claimedAmount")}
            value={form.claimedAmount}
            onChange={(e) => setForm({ ...form, claimedAmount: Number(e.target.value) })}
            InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
            fullWidth
          />
          <TextField
            label={t("claims.form.description")} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            fullWidth multiline rows={4}
            helperText={t("claims.form.descriptionHelp")}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || !form.policyId}>
          {save.isPending ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ====================== Edit dialog (status + amounts + notes) ====================== */

function EditClaimDialog({ claim, onClose, onSaved }: {
  claim: ClaimDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    incidentDate: "",
    reportedDate: "",
    claimedAmount: 0,
    approvedAmount: 0,
    description: "",
    status: "Reported" as ClaimStatus
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (claim) {
      setForm({
        incidentDate: claim.incidentDate,
        reportedDate: claim.reportedDate,
        claimedAmount: claim.claimedAmount ?? 0,
        approvedAmount: claim.approvedAmount ?? 0,
        description: claim.description ?? "",
        status: claim.status
      });
    }
  }, [claim?.id]);

  const updateMutation = useMutation({
    mutationFn: async () =>
      (await api.put<ClaimDto>(`/claims/${claim!.id}`, {
        incidentDate: form.incidentDate,
        reportedDate: form.reportedDate,
        claimedAmount: form.claimedAmount > 0 ? form.claimedAmount : null,
        approvedAmount: form.approvedAmount > 0 ? form.approvedAmount : null,
        description: form.description.trim() || null
      })).data,
    onError: (err) => setError(extractErrorMessage(err))
  });

  const statusMutation = useMutation({
    mutationFn: async () =>
      (await api.post<ClaimDto>(`/claims/${claim!.id}/status`, {
        status: form.status,
        approvedAmount: form.approvedAmount > 0 ? form.approvedAmount : null
      })).data,
    onError: (err) => setError(extractErrorMessage(err))
  });

  const handleSave = async () => {
    setError(null);
    try {
      await updateMutation.mutateAsync();
      if (form.status !== claim?.status) {
        await statusMutation.mutateAsync();
      }
      onSaved();
    } catch {
      // errors surfaced via onError above
    }
  };

  return (
    <Dialog open={!!claim} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{t("claims.form.editTitle")}</Typography>
          {claim && <Chip label={claim.claimNumber} variant="outlined" size="small" />}
        </Stack>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {claim && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {claim.policyNumber} · {t(`policies.types.${claim.policyType}`)} · {claim.customerDisplay}
          </Typography>
        )}
        <Stack spacing={2.5} mt={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date" label={t("claims.form.incidentDate")}
              InputLabelProps={{ shrink: true }} value={form.incidentDate}
              onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
              fullWidth required
            />
            <TextField
              type="date" label={t("claims.form.reportedDate")}
              InputLabelProps={{ shrink: true }} value={form.reportedDate}
              onChange={(e) => setForm({ ...form, reportedDate: e.target.value })}
              fullWidth required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="number" label={t("claims.form.claimedAmount")} value={form.claimedAmount}
              onChange={(e) => setForm({ ...form, claimedAmount: Number(e.target.value) })}
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
              fullWidth
            />
            <TextField
              type="number" label={t("claims.form.approvedAmount")} value={form.approvedAmount}
              onChange={(e) => setForm({ ...form, approvedAmount: Number(e.target.value) })}
              InputProps={{ endAdornment: <InputAdornment position="end">€</InputAdornment> }}
              fullWidth
            />
          </Stack>

          <TextField
            select label={t("claims.col.status")} value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ClaimStatus })}
            fullWidth
          >
            {(["Reported","UnderReview","Approved","Rejected","Paid","Closed"] as const).map(s =>
              <MenuItem key={s} value={s}>{t(`claims.statuses.${s}`)}</MenuItem>
            )}
          </TextField>

          <TextField
            label={t("claims.form.description")} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            fullWidth multiline rows={4}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending || statusMutation.isPending}>
          {(updateMutation.isPending || statusMutation.isPending) ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
