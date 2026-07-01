import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { useCarrierCatalogue } from "../hooks/useCarrierCatalogue";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import GroupsIcon from "@mui/icons-material/Groups";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { money, date } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { ExportButton } from "../components/ExportButton";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { useTableState } from "../components/useTableState";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { PolicyDeliveryPage } from "./PolicyDeliveryPage";
import { GroupPoliciesPage } from "./GroupPoliciesPage";
import { SearchableSelect } from "../components/SearchableSelect";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type PolicyStatus = "Draft" | "Active" | "Expired" | "Cancelled" | "Renewed" | "PendingRenewal";

interface PolicyDto {
  id: string;
  policyNumber: string;
  customerId: string;
  customerDisplay: string;
  insuranceCompanyId: string;
  insuranceCompanyName: string;
  producerId: string | null;
  producerName: string | null;
  policyType: PolicyType;
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  createdAt: string;
}

interface CustomerLite {
  id: string;
  customerNumber: string;
  type: "Individual" | "Company";
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

interface CarrierDto {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isBroker?: boolean;
  parentCompanyId?: string | null;
}

const STATUS_COLOR: Record<PolicyStatus, "default" | "success" | "warning" | "info" | "error"> = {
  Active: "success",
  PendingRenewal: "warning",
  Expired: "warning",
  Cancelled: "error",
  Renewed: "info",
  Draft: "default"
};

export function PoliciesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isCustomer = user?.role === "Customer";
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyUser";
  const requestedView = searchParams.get("view");
  const activeView: "policies" | "delivery" | "group" = canEdit && (requestedView === "delivery" || requestedView === "group") ? requestedView : "policies";

  const setActiveView = (view: "policies" | "delivery" | "group") => {
    const next = new URLSearchParams(searchParams);
    if (view === "delivery" || view === "group") next.set("view", view);
    else next.delete("view");
    setSearchParams(next);
  };

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<PolicyType | "">("");
  const [carrierFilter, setCarrierFilter] = useState<string>("");
  const [subCarrierFilter, setSubCarrierFilter] = useState<string[]>([]);
  const [producerFilter, setProducerFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Carrier-driven Κλάδος options — empty when no carrier is selected.
  const filterCatalogue = useCarrierCatalogue(carrierFilter, subCarrierFilter);

  const carriersQuery = useQuery({
    queryKey: ["insurance-companies-for-filter"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies")).data
  });
  const producersQuery = useQuery({
    queryKey: ["producers-for-filter"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDto | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<PolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const policiesQuery = useQuery({
    queryKey: ["policies", search, statusFilter, typeFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      return (await api.get<PolicyDto[]>("/policies", { params })).data;
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<PolicyDto>(`/policies/${id}/cancel`, { reason: null })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["policies"] }),
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [blockers, setBlockers] = useState<{ kind: string; count: number; message: string }[] | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<{ deleted: boolean; blockers: { kind: string; count: number; message: string }[] }>(`/policies/${id}`)).data,
    onSuccess: (res) => {
      if (!res.deleted) { setBlockers(res.blockers); return; }
      setBlockers(null);
      void qc.invalidateQueries({ queryKey: ["policies"] });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rawRows = policiesQuery.data ?? [];
  const documentPolicyId = searchParams.get("documentPolicyId");
  useEffect(() => {
    if (documentPolicyId && rawRows.some(policy => policy.id === documentPolicyId))
      setDetailId(documentPolicyId);
  }, [documentPolicyId, rawRows]);
  const allRows = useMemo(() => {
    const allCarriers = carriersQuery.data ?? [];
    return rawRows.filter(p => {
      if (carrierFilter) {
        if (subCarrierFilter.length > 0) {
          // Sub picks narrow strictly to those subs.
          if (!subCarrierFilter.includes(p.insuranceCompanyId)) return false;
        } else {
          // No subs picked — match the carrier itself OR (when broker) any of its subs.
          const allowed = new Set<string>([carrierFilter]);
          for (const c of allCarriers) {
            if (c.parentCompanyId === carrierFilter) allowed.add(c.id);
          }
          if (!allowed.has(p.insuranceCompanyId)) return false;
        }
      }
      if (producerFilter && p.producerId !== producerFilter) return false;
      if (fromDate && p.startDate < fromDate) return false;
      if (toDate   && p.startDate > toDate)   return false;
      return true;
    });
  }, [rawRows, carriersQuery.data, carrierFilter, subCarrierFilter, producerFilter, fromDate, toDate]);

  // Phase 15.2 — client-side search + sort + pagination.
  const table = useTableState<PolicyDto>({
    rows: allRows,
    searchableText: (p) => `${p.policyNumber} ${p.customerDisplay ?? ""} ${p.insuranceCompanyName} ${p.producerName ?? ""} ${p.policyType} ${p.status}`,
    pageSize: 25,
    initialSortKey: "createdAt" as keyof PolicyDto,
    initialSortDir: "desc"
  });
  const rows = table.paged;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {isCustomer ? t("policies.customerTitle") : t("policies.agencyTitle")}
            </Typography>
            <HelpHint id="page.policies" />
          </Stack>
          <Typography color="text.secondary">
            {isCustomer ? t("policies.customerLead") : t("policies.agencyLead")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {canEdit && activeView === "policies" && <ExportButton href="/api/exports/policies.csv" />}
          {canEdit && activeView === "policies" && (
            <Button data-tour="policies-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateOpen(true); }}>
              {t("policies.create")}
            </Button>
          )}
        </Stack>
      </Stack>

      {canEdit && (
        <Card variant="outlined" sx={{ p: 1, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant={activeView === "policies" ? "contained" : "outlined"}
              onClick={() => setActiveView("policies")}
            >
              {t("nav.contracts")}
            </Button>
            <Button
              startIcon={<LocalShippingIcon />}
              variant={activeView === "delivery" ? "contained" : "outlined"}
              onClick={() => setActiveView("delivery")}
            >
              {t("delivery.title")}
            </Button>
            <Button
              startIcon={<GroupsIcon />}
              variant={activeView === "group" ? "contained" : "outlined"}
              onClick={() => setActiveView("group")}
            >
              {t("groupPolicies.title")}
            </Button>
          </Stack>
        </Card>
      )}

      {activeView === "delivery" ? (
        <PolicyDeliveryPage embedded />
      ) : activeView === "group" ? (
        <GroupPoliciesPage embedded />
      ) : (
        <>
      {!isCustomer && (
        <Card sx={{ p: 2, mb: 2 }} data-tour="policies-search">
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                fullWidth size="small"
                placeholder={t("policies.searchPlaceholder") + " · ΑΦΜ · αρ. απόδειξης · πινακίδα"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
              />
              <TextField select size="small" label={t("policies.col.status")}
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PolicyStatus | "")}
                sx={{ minWidth: { sm: 170 } }}>
                <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
                {(["Draft","Active","Expired","Cancelled","Renewed","PendingRenewal"] as const).map(s =>
                  <MenuItem key={s} value={s}>{t(`policies.statuses.${s}`)}</MenuItem>)}
              </TextField>
              <TextField select size="small" label={t("policies.col.type")}
                value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PolicyType | "")}
                sx={{ minWidth: { sm: 220 } }}
                disabled={!carrierFilter}
                helperText={!carrierFilter
                  ? "Επιλέξτε εταιρία"
                  : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}>
                <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
                {filterCatalogue.branches.map(b => (
                  <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <SearchableSelect
                label="Εταιρία"
                value={carrierFilter}
                onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); }}
                emptyLabel="Όλες"
                options={(carriersQuery.data ?? [])
                  .filter(c => !c.parentCompanyId)
                  .map(c => ({
                    value: c.id,
                    label: c.name,
                    hint: c.isBroker ? "πρακτορείο" : c.code,
                  }))}
              />
              {(() => {
                const selected = (carriersQuery.data ?? []).find(c => c.id === carrierFilter);
                if (!selected?.isBroker) return null;
                const subs = (carriersQuery.data ?? []).filter(c => c.parentCompanyId === selected.id);
                return (
                  <Autocomplete<CarrierDto, true>
                    multiple size="small" sx={{ minWidth: 280, flex: 1 }}
                    options={subs}
                    value={subs.filter(s => subCarrierFilter.includes(s.id))}
                    onChange={(_, value) => setSubCarrierFilter(value.map(v => v.id))}
                    getOptionLabel={(s) => s.name}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    renderInput={(params) => <TextField {...params} label="Υποασφαλιστικές" />}
                  />
                );
              })()}
              <SearchableSelect
                label="Συνεργάτης"
                value={producerFilter}
                onChange={(v) => setProducerFilter(v)}
                emptyLabel="Όλοι"
                options={(producersQuery.data ?? []).map(p => ({
                  value: p.id, label: p.name, hint: p.code,
                }))}
              />
              <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }}
                value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: { sm: 160 } }} />
              <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }}
                value={toDate}   onChange={(e) => setToDate(e.target.value)}   sx={{ minWidth: { sm: 160 } }} />
              <Button size="small" onClick={() => {
                setCarrierFilter(""); setSubCarrierFilter([]); setProducerFilter("");
                setFromDate(""); setToDate(""); setStatusFilter(""); setTypeFilter(""); setSearch("");
              }}>Καθαρισμός</Button>
            </Stack>
          </Stack>
        </Card>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {policiesQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : (
        <Card>
          <Box sx={{ px: 2, pt: 2 }}>
            <TableToolbar<PolicyDto>
              query={table.query} onQuery={table.setQuery}
              count={allRows.length} filteredCount={table.filtered.length}
              pageSize={table.pageSize} onPageSize={table.setPageSize}
              exportRows={table.filtered}
              exportFileName={`policies-${new Date().toISOString().slice(0, 10)}`}
              serverEntity="policies"
              serverParams={{ search: table.query }}
              exportColumns={[
                { key: "policyNumber", label: "Αρ. Συμβ." },
                { key: "policyType", label: "Κλάδος" },
                { key: "customerDisplay", label: "Πελάτης" },
                { key: "insuranceCompanyName", label: "Εταιρία" },
                { key: "producerName", label: "Συνεργάτης" },
                { key: "startDate", label: "Έναρξη" },
                { key: "endDate", label: "Λήξη" },
                { key: "premium", label: "Ασφάλιστρο" },
                { key: "currency", label: "Νόμισμα" },
                { key: "status", label: "Κατάσταση" }
              ]}
            />
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("policies.col.number")}</TableCell>
                  <TableCell>{t("policies.col.type")}</TableCell>
                  {!isCustomer && <TableCell>{t("policies.col.customer")}</TableCell>}
                  <TableCell>{t("policies.col.carrier")}</TableCell>
                  <TableCell>{t("policies.col.dates")}</TableCell>
                  <TableCell align="right">{t("policies.col.premium")}</TableCell>
                  <TableCell>{t("policies.col.status")}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => {
                  const daysToEnd = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const expiringSoon = daysToEnd > 0 && daysToEnd <= 30 && p.status === "Active";
                  return (
                    <TableRow key={p.id} hover sx={{ cursor: "pointer" }}
                      data-tour="policies-row"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root")) return;
                        setDetailId(p.id);
                      }}>
                      <TableCell><Chip label={p.policyNumber} variant="outlined" size="small" /></TableCell>
                      <TableCell>{t(`policies.types.${p.policyType}`)}</TableCell>
                      {!isCustomer && <TableCell><Typography fontWeight={600}>{p.customerDisplay}</Typography></TableCell>}
                      <TableCell>{p.insuranceCompanyName}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{date(p.startDate)} → {date(p.endDate)}</Typography>
                        {expiringSoon && (
                          <Typography variant="caption" color="warning.main" fontWeight={700}>
                            {t("policies.expiresIn", { days: daysToEnd })}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700}>{money(p.premium, p.currency)}</Typography>
                      </TableCell>
                      <TableCell><Chip data-tour="policies-status" label={t(`policies.statuses.${p.status}`)} color={STATUS_COLOR[p.status]} size="small" /></TableCell>
                      {canEdit && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => setEditingPolicy(p)} title={t("common.edit")}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setRenewing(p)}
                              title={t("policies.actions.renew")}
                              disabled={p.status === "Cancelled" || p.status === "Renewed"}
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => { if (confirm(t("policies.confirmCancel"))) cancelMutation.mutate(p.id); }}
                              title={t("policies.actions.cancel")}
                              disabled={p.status === "Cancelled"}
                              color="error"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => deleteMutation.mutate(p.id)}
                              title="Διαγραφή"
                              color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : isCustomer ? 6 : 7}>
                      <Typography color="text.secondary" textAlign="center" py={4}>{t("policies.noPolicies")}</Typography>
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
          <PolicyFormDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            policy={null}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setCreateOpen(false); }}
          />
          <PolicyFormDialog
            open={!!editingPolicy}
            onClose={() => setEditingPolicy(null)}
            policy={editingPolicy}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setEditingPolicy(null); }}
          />
          <RenewDialog
            policy={renewing}
            onClose={() => setRenewing(null)}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setRenewing(null); }}
          />
          <PolicyDetailDrawer
            policyId={detailId}
            open={!!detailId}
            onClose={() => setDetailId(null)}
          />
        </>
      )}

      <Dialog open={!!blockers} onClose={() => setBlockers(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Δεν είναι δυνατή η διαγραφή</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Το συμβόλαιο έχει εξαρτημένες εγγραφές. Διαγράψτε τις παρακάτω πρώτα,
            με τη σειρά που εμφανίζονται, και μετά επαναλάβετε τη διαγραφή.
          </Alert>
          <Stack spacing={1.5}>
            {(blockers ?? []).map((b, i) => (
              <Card variant="outlined" key={b.kind} sx={{ p: 2 }}>
                <Typography fontWeight={800}>{i + 1}. {b.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Πλήθος: {b.count} · κατηγορία: <code>{b.kind}</code>
                </Typography>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockers(null)} variant="contained">Κατάλαβα</Button>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
  );
}

/* ====================== Create/Edit dialog ====================== */

interface FormBody {
  customerId: string;
  insuranceCompanyId: string;
  policyType: PolicyType;
  vehicleUseCategory: string;
  coverCode: string;
  packageCode: string;
  startDate: string;
  endDate: string;
  premium: number;
  currency: string;
  status: PolicyStatus;
}

function PolicyFormDialog({
  open,
  onClose,
  policy,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  policy: PolicyDto | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!policy;

  const customersQuery = useQuery({
    queryKey: ["customers", "minimal"],
    queryFn: async () => (await api.get<CustomerLite[]>("/customers")).data,
    enabled: open
  });
  const carriersQuery = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies")).data,
    enabled: open
  });

  const [form, setForm] = useState<FormBody>({
    customerId: "",
    insuranceCompanyId: "",
    policyType: "Auto",
    vehicleUseCategory: "",
    coverCode: "",
    packageCode: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    premium: 0,
    currency: "EUR",
    status: "Active"
  });
  const [error, setError] = useState<string | null>(null);
  const dialogCatalogue = useCarrierCatalogue(form.insuranceCompanyId);

  useEffect(() => {
    if (policy) {
      setForm({
        customerId: policy.customerId,
        insuranceCompanyId: policy.insuranceCompanyId,
        policyType: policy.policyType,
        vehicleUseCategory: "",
        coverCode: "",
        packageCode: "",
        startDate: policy.startDate,
        endDate: policy.endDate,
        premium: policy.premium,
        currency: policy.currency,
        status: policy.status
      });
    } else if (open) {
      setForm({
        customerId: "",
        insuranceCompanyId: "",
        policyType: "Auto",
        vehicleUseCategory: "",
        coverCode: "",
        packageCode: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
        premium: 0,
        currency: "EUR",
        status: "Active"
      });
    }
  }, [policy, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        insuranceCompanyId: form.insuranceCompanyId,
        producerId: null,
        policyType: form.policyType,
        vehicleUseCategory: form.vehicleUseCategory || null,
        coverCode: form.coverCode || null,
        packageCode: form.packageCode || null,
        startDate: form.startDate,
        endDate: form.endDate,
        premium: form.premium,
        currency: form.currency,
        status: form.status,
      };
      if (editing && policy) {
        return (await api.put<PolicyDto>(`/policies/${policy.id}`, body)).data;
      } else {
        return (await api.post<PolicyDto>("/policies", { ...form, ...body, customerId: form.customerId })).data;
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  const customerOptions = useMemo(() => {
    return (customersQuery.data ?? []).map((c) => ({
      id: c.id,
      label: c.type === "Individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""} · ${c.customerNumber}`.trim()
        : `${c.companyName} · ${c.customerNumber}`
    }));
  }, [customersQuery.data]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("policies.form.editTitle") : t("policies.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5} mt={1}>
          <TextField
            select label={t("policies.form.customer")}
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            fullWidth required disabled={editing}
            helperText={editing ? t("policies.form.customerLocked") : undefined}
          >
            {customerOptions.map((c) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
          </TextField>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select label={t("policies.form.carrier")}
              value={form.insuranceCompanyId}
              onChange={(e) => setForm({ ...form, insuranceCompanyId: e.target.value, policyType: "Auto", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
              fullWidth required
            >
              {(carriersQuery.data ?? []).filter(c => !c.parentCompanyId).map(c => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}{c.isBroker ? " · πρακτορείο" : ""}
                </MenuItem>
              ))}
            </TextField>
            {(() => {
              const carrierData = carriersQuery.data ?? [];
              const selected = carrierData.find(c => c.id === form.insuranceCompanyId);
              const broker = selected?.isBroker
                ? selected
                : selected?.parentCompanyId
                  ? carrierData.find(c => c.id === selected.parentCompanyId)
                  : null;
              if (!broker?.isBroker) return null;
              const subs = carrierData.filter(c => c.parentCompanyId === broker.id);
              const subValue = selected?.id !== broker.id ? selected?.id ?? "" : "";
              return (
                <TextField select label="Υποασφαλιστική" value={subValue}
                  onChange={e => setForm({ ...form, insuranceCompanyId: e.target.value || broker.id, vehicleUseCategory: "", coverCode: "", packageCode: "" })}
                  fullWidth>
                  <MenuItem value="">— επιλέξτε υποασφαλιστική —</MenuItem>
                  {subs.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              );
            })()}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select label={t("policies.form.type")}
              value={form.policyType}
              onChange={(e) => setForm({ ...form, policyType: e.target.value as PolicyType })}
              fullWidth required
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία πρώτα"
                : dialogCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
            >
              {dialogCatalogue.branches.map(b => (
                <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Χρήση οχήματος"
              value={form.vehicleUseCategory}
              onChange={(e) => setForm({ ...form, vehicleUseCategory: e.target.value })}
              fullWidth
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
            >
              <MenuItem value="">—</MenuItem>
              {dialogCatalogue.uses.map(u => (
                <MenuItem key={u.key} value={u.value}>{u.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select label="Κάλυψη"
              value={form.coverCode}
              onChange={(e) => setForm({ ...form, coverCode: e.target.value })}
              fullWidth
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
            >
              <MenuItem value="">—</MenuItem>
              {dialogCatalogue.coverages.map(c => (
                <MenuItem key={c.key} value={c.value}>{c.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Πακέτο"
              value={form.packageCode}
              onChange={(e) => setForm({ ...form, packageCode: e.target.value })}
              fullWidth
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.packages.length === 0 ? "Δεν υπάρχουν πακέτα" : ""}
            >
              <MenuItem value="">—</MenuItem>
              {dialogCatalogue.packages.map(p => (
                <MenuItem key={p.key} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              fullWidth required
            />
            <TextField
              type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              fullWidth required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="number" label={t("policies.form.premium")}
              value={form.premium}
              onChange={(e) => setForm({ ...form, premium: Number(e.target.value) })}
              InputProps={{ endAdornment: <InputAdornment position="end">{form.currency}</InputAdornment> }}
              fullWidth required
            />
            <TextField
              select label={t("policies.col.status")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PolicyStatus })}
              fullWidth
            >
              {(["Draft","Active","PendingRenewal","Expired","Cancelled","Renewed"] as const).map(s =>
                <MenuItem key={s} value={s}>{t(`policies.statuses.${s}`)}</MenuItem>
              )}
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <CircularProgress size={18} /> : t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ====================== Renew dialog ====================== */

function RenewDialog({
  policy,
  onClose,
  onSaved
}: {
  policy: PolicyDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [premium, setPremium] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policy) {
      const nextStart = policy.endDate;
      const nextEnd = new Date(new Date(policy.endDate).getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setPremium(policy.premium);
    }
  }, [policy?.id, policy?.endDate, policy?.premium]);

  const mutation = useMutation({
    mutationFn: async () => (await api.post<PolicyDto>(`/policies/${policy!.id}/renew`,
      { startDate, endDate, premium })).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={!!policy} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("policies.renew.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("policies.renew.body", { num: policy?.policyNumber ?? "" })}
        </Typography>
        <Stack spacing={2.5}>
          <Divider />
          <TextField type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
            value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth required />
          <TextField type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
            value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth required />
          <TextField type="number" label={t("policies.form.premium")}
            value={premium} onChange={(e) => setPremium(Number(e.target.value))}
            InputProps={{ endAdornment: <InputAdornment position="end">{policy?.currency ?? "EUR"}</InputAdornment> }}
            fullWidth required />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="contained" startIcon={<AutorenewIcon />} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <CircularProgress size={18} /> : t("policies.actions.renew")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
