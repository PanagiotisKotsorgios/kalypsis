import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp } from "../components/FilterHelp";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
import { useDraftPersistence } from "../hooks/useDraftPersistence";
import { useCustomerSearch } from "../hooks/useCustomerSearch";
import { InlineCreateCustomerDialog } from "../components/InlineCreateCustomerDialog";
import { InlineCreateInsuranceCompanyDialog } from "../components/InlineCreateInsuranceCompanyDialog";
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
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import TuneIcon from "@mui/icons-material/Tune";
import { money, date } from "../utils/format";
import { contractDurationLabel } from "../utils/contractDuration";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { PolicyDetailDrawer } from "../components/PolicyDetailDrawer";
import { useTableState } from "../components/useTableState";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { PolicyDeliveryPage } from "./PolicyDeliveryPage";
import { GroupPoliciesPage } from "./GroupPoliciesPage";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useUndoable } from "../components/UndoToast";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { QuickFilterBar } from "../components/QuickFilterBar";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { BulkImportDialog, type BulkImportResult } from "../components/BulkImportDialog";
import { ExcelImportButton } from "../components/ExcelImportButton";

type PolicyType = "Auto" | "Home" | "Health" | "Life" | "Business" | "Travel" | "Other";
type PolicyStatus = "Draft" | "Active" | "Expired" | "Cancelled" | "Renewed" | "PendingRenewal" | "Undelivered" | "AwaitingIssue" | "Prospect";
type PaymentRoute = "" | "direct" | "office";

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
  paidDirectlyToCarrier: boolean;
  deliveredAt: string | null;
  startDate: string;
  endDate: string;
  premium: number;
  netPremium: string;
  specialCommissionPercent: string;
  currency: string;
  createdAt: string;
}

// Kept for typing; the picker now uses useCustomerSearch's own CustomerLite.
// @ts-expect-error kept for backwards-compat with older imports
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
  Draft: "default",
  // ALIS-parity — awaiting-issue reads as "in progress", undelivered as
  // "waiting on us" so the color scheme still gives operators a signal.
  AwaitingIssue: "info",
  Undelivered: "warning",
  Prospect: "warning"
};

const POLICY_IMPORT_COLUMNS = [
  { key: "customerId", label: "ID πελάτη", required: true, example: "00000000-0000-0000-0000-000000000000" },
  { key: "policyNumber", label: "Αριθμός συμβολαίου", example: "POL-1001" },
  { key: "insuranceCompanyId", label: "ID ασφαλιστικής", required: true, example: "00000000-0000-0000-0000-000000000000" },
  { key: "producerId", label: "ID συνεργάτη", example: "" },
  { key: "policyType", label: "Κλάδος (Auto/Home/Health/Life/Business/Travel/Other ή κωδικός γραφείου)", required: true, example: "Auto" },
  { key: "vehicleUseCategory", label: "Χρήση οχήματος", example: "Ιδιωτική χρήση" },
  { key: "coverCode", label: "Κωδικός κάλυψης", example: "" },
  { key: "packageCode", label: "Κωδικός πακέτου", example: "" },
  { key: "startDate", label: "Έναρξη (YYYY-MM-DD)", required: true, example: "2026-10-01" },
  { key: "endDate", label: "Λήξη (YYYY-MM-DD)", required: true, example: "2027-10-01" },
  { key: "premium", label: "Μικτό ασφάλιστρο", required: true, example: "250.00" },
  { key: "netPremium", label: "Καθαρά ασφάλιστρα", example: "" },
  { key: "specialCommissionPercent", label: "Προμήθεια συνεργάτη (%)", example: "10" },
  { key: "vatAmount", label: "Φόρος ασφαλίστρων (€)", example: "" },
  { key: "currency", label: "Νόμισμα", example: "EUR" },
  { key: "status", label: "Κατάσταση", example: "Active" },
  { key: "paidDirectlyToCarrier", label: "Πληρώθηκε απευθείας στην εταιρεία (true/false)", example: "false" },
] as const;

export function PoliciesPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isCustomer = user?.role === "Customer";
  const isProducer = user?.role === "Producer";
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser";
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
  // ALIS-parity search filters — plate + application number + premium range
  // are the three daily-driver lookups brokers do multiple times a day.
  const [plateFilter, setPlateFilter] = useState<string>("");
  const [appNumberFilter, setAppNumberFilter] = useState<string>("");
  const [premiumMin, setPremiumMin] = useState<string>("");
  const [premiumMax, setPremiumMax] = useState<string>("");
  const [expiryWindow, setExpiryWindow] = useState<"" | "5" | "10" | "20" | "30" | "60" | "90">("");
  const [paymentRouteFilter, setPaymentRouteFilter] = useState<PaymentRoute>("");

  // Carrier-driven Κλάδος options — empty when no carrier is selected.
  const filterCatalogue = useCarrierCatalogue(carrierFilter, subCarrierFilter);

  const carriersQuery = useQuery({
    queryKey: ["insurance-companies-for-filter-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data
  });
  const producersQuery = useQuery({
    queryKey: ["producers-for-filter"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data
  });

  const [createStatus, setCreateStatus] = useState<PolicyStatus | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<PolicyDto | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<PolicyDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);

  // Deep-link support — the customer card sends operators here as
  // /app/policies?focus=<policyId>. Read the id once on mount and open
  // the detail drawer so it feels like «click policy → see full policy».
  useEffect(() => {
    const id = searchParams.get("focus");
    if (id && !detailId) setDetailId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("focus")]);

  const policiesQuery = useQuery({
    queryKey: ["policies", search, statusFilter, typeFilter, plateFilter, appNumberFilter, premiumMin, premiumMax],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (plateFilter.trim()) params.plate = plateFilter.trim();
      if (appNumberFilter.trim()) params.applicationNumber = appNumberFilter.trim();
      if (premiumMin.trim()) params.premiumMin = premiumMin.trim();
      if (premiumMax.trim()) params.premiumMax = premiumMax.trim();
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
  // Bulk selection for multi-row updates. Only AgencyAdmin sees the checkbox
  // column, so viewers can't accidentally select-and-mutate.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const { pushUndoable } = useUndoable();

  // User-configurable table columns. Order and visibility persist per
  // (user × table) via useColumnPreferences → localStorage. "number" and
  // "actions" stay alwaysVisible so the operator always has an id column
  // and a way to open/edit a row.
  const columnPrefs = useColumnPreferences("policies", [
    { key: "number",   label: "Αρ. Συμβολαίου", alwaysVisible: true },
    { key: "type",     label: "Κλάδος" },
    { key: "customer", label: "Πελάτης" },
    { key: "carrier",  label: "Ασφαλιστική" },
    { key: "producer", label: "Συνεργάτης", defaultVisible: false },
    { key: "dates",    label: "Έναρξη → Λήξη" },
    { key: "premium",  label: "Ασφάλιστρο" },
    { key: "status",   label: "Κατάσταση" },
  ]);

  // Column semantic type — used by useHeaderContextMenu below for the sort
  // labels («Α→Ω», «Παλιότερα → Νεότερα», «Χαμηλότερα → Υψηλότερα»).
  const inferType = (key: string): ColumnType =>
    key === "dates" ? "date" : key === "premium" ? "number" : "string";
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = (await api.delete<{ deleted: boolean; blockers: { kind: string; count: number; message: string }[] }>(`/policies/${id}`)).data;
      return { ...res, id };
    },
    onSuccess: (res) => {
      if (!res.deleted) { setBlockers(res.blockers); return; }
      setBlockers(null);
      void qc.invalidateQueries({ queryKey: ["policies"] });
      pushUndoable({
        category: "policies", id: res.id,
        message: "Το συμβόλαιο διαγράφηκε",
        onRestore: () => { void qc.invalidateQueries({ queryKey: ["policies"] }); }
      });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const rawRows = policiesQuery.data ?? [];
  const documentPolicyId = searchParams.get("documentPolicyId");
  // Deep-link: `/app/policies?documentPolicyId={guid}` opens that policy's
  // drawer directly. We DON'T gate on the policy being present in the
  // filtered list — the drawer fetches its own detail via
  // /api/policies/{id}/detail, so a filter that would hide the row
  // shouldn't hide the deep-linked drawer. We also strip the query
  // param from the URL immediately so closing the drawer doesn't get
  // re-triggered by the same param on a re-render.
  useEffect(() => {
    if (!documentPolicyId) return;
    setDetailId(documentPolicyId);
    const next = new URLSearchParams(searchParams);
    next.delete("documentPolicyId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentPolicyId]);
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
      if (paymentRouteFilter === "direct" && !p.paidDirectlyToCarrier) return false;
      if (paymentRouteFilter === "office" && p.paidDirectlyToCarrier) return false;
      if (expiryWindow) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(p.endDate);
        const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        if (p.status !== "Active" || days < 0 || days > Number(expiryWindow)) return false;
      }
      return true;
    });
  }, [rawRows, carriersQuery.data, carrierFilter, subCarrierFilter, producerFilter, fromDate, toDate, expiryWindow, paymentRouteFilter]);

  // Phase 15.2 — client-side search + sort + pagination.
  const table = useTableState<PolicyDto>({
    rows: allRows,
    searchableText: (p) => `${p.policyNumber} ${p.customerDisplay ?? ""} ${p.insuranceCompanyName} ${p.producerName ?? ""} ${p.policyType} ${p.status}`,
    pageSize: 25,
    initialSortKey: "createdAt" as keyof PolicyDto,
    initialSortDir: "desc"
  });
  const rows = table.paged;
  const clearPolicyFilters = () => {
    setCarrierFilter(""); setSubCarrierFilter([]); setProducerFilter("");
    setFromDate(""); setToDate(""); setStatusFilter(""); setTypeFilter(""); setSearch("");
    setPlateFilter(""); setAppNumberFilter(""); setPremiumMin(""); setPremiumMax("");
    setExpiryWindow("");
    setPaymentRouteFilter("");
    table.setQuery(""); table.setPage(1);
  };
  const policyFilterCount = [
    search, statusFilter, typeFilter, carrierFilter, producerFilter, fromDate, toDate,
    plateFilter, appNumberFilter, premiumMin, premiumMax, expiryWindow, paymentRouteFilter, table.query,
  ].filter(Boolean).length;

  const importPolicies = async (importRows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0;
    const errors: string[] = [];
    const failedRows: Record<string, string>[] = [];
    const statuses = new Set<PolicyStatus>(["Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal", "Undelivered", "AwaitingIssue", "Prospect"]);
    const optionalNumber = (value: string | undefined) => {
      if (!value?.trim()) return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`Μη έγκυρος αριθμός: ${value}`);
      return parsed;
    };
    const booleanValue = (value: string | undefined) => ["true", "1", "yes", "ναι"].includes((value ?? "").trim().toLowerCase());
    for (let index = 0; index < importRows.length; index++) {
      const row = importRows[index];
      try {
        const premium = Number(row.premium);
        if (!Number.isFinite(premium) || premium < 0) throw new Error("Το premium πρέπει να είναι έγκυρος αριθμός.");
        if (!row.policyType?.trim()) throw new Error("Το policyType είναι υποχρεωτικό.");
        if (row.status && !statuses.has(row.status as PolicyStatus)) throw new Error("Μη έγκυρο status.");
        if (Number.isNaN(new Date(row.startDate).getTime()) || Number.isNaN(new Date(row.endDate).getTime())) {
          throw new Error("Οι ημερομηνίες startDate/endDate δεν είναι έγκυρες.");
        }
        await api.post("/policies", {
          customerId: row.customerId.trim(),
          policyNumber: row.policyNumber?.trim() || null,
          insuranceCompanyId: row.insuranceCompanyId.trim(),
          producerId: row.producerId?.trim() || null,
          policyType: row.policyType.trim(),
          vehicleUseCategory: row.vehicleUseCategory?.trim() || null,
          coverCode: row.coverCode?.trim() || null,
          packageCode: row.packageCode?.trim() || null,
          startDate: row.startDate,
          endDate: row.endDate,
          premium,
          netPremium: optionalNumber(row.netPremium),
          specialCommissionPercent: optionalNumber(row.specialCommissionPercent),
          vatAmount: optionalNumber(row.vatAmount),
          currency: (row.currency?.trim() || "EUR").toUpperCase(),
          status: row.status?.trim() || "Active",
          paidDirectlyToCarrier: booleanValue(row.paidDirectlyToCarrier),
        });
        imported++;
      } catch (e) {
        failedRows.push(row);
        errors.push(`Row ${index + 2}: ${extractErrorMessage(e)}`);
      }
    }
    void qc.invalidateQueries({ queryKey: ["policies"] });
    return { imported, failed: importRows.length - imported, errors, failedRows };
  };

  // Right-click on a header → sort + hide column; right-click on a row →
  // open detail + delete. Placed here so `table` (defined just above) is
  // in scope for the callbacks.
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof PolicyDto> = {
        number: "policyNumber", type: "policyType", customer: "customerDisplay",
        carrier: "insuranceCompanyName", producer: "producerName",
        dates: "startDate", premium: "premium", status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
    onHide: (key) => columnPrefs.toggleVisibility(key),
  });
  const rowMenu = useRowContextMenu<PolicyDto>({
    entityLabel: "συμβολαίου",
    onEdit: (p) => { window.location.href = `/app/policies/${p.id}`; },
    onDelete: (p) => {
      if (canEdit && confirm(`Διαγραφή συμβολαίου ${p.policyNumber};`)) deleteMutation.mutate(p.id);
    },
  });

  const policyQuickFilters = (
    <QuickFilterBar
      activeCount={policyFilterCount}
      onClear={clearPolicyFilters}
      options={[
        { key: "all", label: "Όλα", active: policyFilterCount === 0, onClick: clearPolicyFilters },
        ...([5, 10, 20, 30, 60, 90] as const).map(days => ({
          key: `expiry-${days}`,
          label: `Λήγουν ≤${days} ημέρες`,
          active: expiryWindow === String(days),
          color: days <= 20 ? "error" as const : days <= 30 ? "warning" as const : "info" as const,
          onClick: () => { setExpiryWindow(String(days) as typeof expiryWindow); setStatusFilter("Active"); setQuickFiltersOpen(false); },
        })),
        { key: "prospects", label: "Πιθανά", active: statusFilter === "Prospect", color: "warning", onClick: () => { setExpiryWindow(""); setStatusFilter("Prospect"); setQuickFiltersOpen(false); } },
        { key: "direct", label: "Πληρώθηκαν απευθείας", active: paymentRouteFilter === "direct", color: "info", onClick: () => { setPaymentRouteFilter("direct"); setQuickFiltersOpen(false); } },
        { key: "office", label: "Πληρωμή στο γραφείο", active: paymentRouteFilter === "office", onClick: () => { setPaymentRouteFilter("office"); setQuickFiltersOpen(false); } },
      ]}
    />
  );

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
          {canEdit && activeView === "policies" && (
            <ExcelImportButton size="large" onClick={() => setImportOpen(true)}>
              Εισαγωγή
            </ExcelImportButton>
          )}
          {/* Ανανεώσεις / Πρόσθετες πράξεις / Ακυρώσεις were briefly here;
              moved down next to the «Ομαδικά συμβόλαια» view-switcher
              button so all lifecycle actions live in the same row. */}
          {canEdit && activeView === "policies" && (
            <>
              <Button variant="outlined" size="large" onClick={() => { setError(null); setCreateStatus("Prospect"); }}>
                Πιθανό συμβόλαιο
              </Button>
              <Button data-tour="policies-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateStatus("Active"); }}>
                {t("policies.create")}
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {canEdit && (
        <Card variant="outlined" sx={{ p: 1, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}
            useFlexGap flexWrap="wrap" alignItems="center">
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
            {/* Cross-links to policy-lifecycle pages — visually separated
                from the view switchers by a small vertical divider so the
                user reads them as "go to another page" not "swap view".
                Kept in the same card row per user request. */}
            <Box sx={{ borderLeft: 1, borderColor: "divider", height: 28, mx: 0.5 }} />
            <Button component={RouterLink} to="/app/renewals"
              variant="outlined" startIcon={<EventRepeatIcon />}
              sx={{
                bgcolor: "#e8f5e9",
                color: "#2e7d32",
                borderColor: "#81c784",
                "&:hover": { bgcolor: "#c8e6c9", borderColor: "#66bb6a", color: "#1b5e20" },
              }}>
              {t("nav.renewals", "Ανανεώσεις")}
            </Button>
            <Button component={RouterLink} to="/app/endorsements"
              variant="outlined" startIcon={<EditNoteIcon />}
              sx={{
                bgcolor: "#fff8e1",
                color: "#8a6d1d",
                borderColor: "#e0c26a",
                "&:hover": { bgcolor: "#ffecb3", borderColor: "#d6a928", color: "#6d5314" },
              }}>
              {t("nav.endorsements", "Πρόσθετες πράξεις")}
            </Button>
            <Button component={RouterLink} to="/app/cancellations"
              variant="outlined" startIcon={<CancelPresentationIcon />}
              sx={{
                bgcolor: "#ffebee",
                color: "#c62828",
                borderColor: "#ef9a9a",
                "&:hover": { bgcolor: "#ffcdd2", borderColor: "#e57373", color: "#b71c1c" },
              }}>
              {t("nav.cancellations", "Ακυρώσεις")}
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
      {isProducer && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Τα συμβόλαια καταχωρούνται και ανατίθενται από το γραφείο. Εδώ βλέπετε μόνο όσα έχουν ανατεθεί σε εσάς, μαζί με τυχόν πιθανά συμβόλαια.
        </Alert>
      )}
       {!isCustomer && (
         <>
            <Card variant="outlined" sx={{ p: 1, mb: 2 }}>
              <Box sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(4, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                  lg: "minmax(300px, 2fr) 130px 130px auto auto",
                },
                gap: 0.75,
                alignItems: "center",
              }}>
                <TextField
                  size="small"
                  fullWidth
                 placeholder="Αναζήτηση αριθμού συμβολαίου, πελάτη, ΑΦΜ ή πινακίδας…"
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: 0, gridColumn: { xs: "auto", sm: "span 2", md: "span 2", lg: "auto" } }}
                 InputProps={{
                   startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                   endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό συμβολαίου, πελάτη, ΑΦΜ, απόδειξη ή πινακίδα οχήματος." />,
                 }}
               />
                <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 0, width: "100%" }} />
                <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 0, width: "100%" }} />
               <Button
                 size="small"
                 variant={policyFilterCount > 0 ? "contained" : "outlined"}
                 startIcon={<TuneIcon />}
                 onClick={() => setAdvancedFiltersOpen(true)}
                  sx={{
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    bgcolor: "#e3f2fd",
                    color: "#1565c0",
                    borderColor: "#90caf9",
                    "&:hover": { bgcolor: "#bbdefb", borderColor: "#64b5f6", color: "#0d47a1" },
                  }}
               >
                 Σύνθετα φίλτρα{policyFilterCount > 0 ? ` (${policyFilterCount})` : ""}
               </Button>
               <Button
                 size="small"
                 variant="outlined"
                 startIcon={<FilterAltIcon />}
                 onClick={() => setQuickFiltersOpen(true)}
                  sx={{
                    whiteSpace: "nowrap",
                    minWidth: 0,
                    bgcolor: "#e3f2fd",
                    color: "#1565c0",
                    borderColor: "#90caf9",
                    "&:hover": { bgcolor: "#bbdefb", borderColor: "#64b5f6", color: "#0d47a1" },
                  }}
               >
                 Γρήγορα φίλτρα
               </Button>
             </Box>
           </Card>
           <Dialog open={advancedFiltersOpen} onClose={() => setAdvancedFiltersOpen(false)} fullWidth maxWidth="md">
             <DialogTitle>Σύνθετα φίλτρα συμβολαίων</DialogTitle>
             <DialogContent dividers>
               <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, pt: .5 }}>
                  <SearchableSelect
                    label="Εταιρεία"
                    value={carrierFilter}
                    onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); }}
                    emptyLabel="Όλες"
                    options={(carriersQuery.data ?? [])
                      .filter(c => !c.parentCompanyId)
                      .map(c => ({ value: c.id, label: c.name, hint: c.isBroker ? "Πρακτορείο" : c.code }))}
                  />
                  <SearchableTextField
                    size="small"
                    label={t("policies.col.type")}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as PolicyType | "")}
                    disabled={!carrierFilter}
                    helperText={!carrierFilter ? "Επιλέξτε πρώτα εταιρεία" : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν κλάδοι" : ""}
                  >
                    <MenuItem value="">Όλοι οι κλάδοι</MenuItem>
                    {filterCatalogue.branches.map(b => <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>)}
                  </SearchableTextField>
                  <SearchableTextField size="small" label={t("policies.col.status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PolicyStatus | "")}>
                   <MenuItem value="">Όλες οι καταστάσεις</MenuItem>
                   {(["Prospect", "Draft", "Active", "Expired", "Cancelled", "Renewed", "PendingRenewal", "Undelivered", "AwaitingIssue"] as const).map(s => <MenuItem key={s} value={s}>{s === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${s}`)}</MenuItem>)}
                 </SearchableTextField>
                 <SearchableSelect
                   label="Συνεργάτης"
                   value={producerFilter}
                   onChange={(v) => setProducerFilter(v)}
                   emptyLabel="Όλοι"
                   options={(producersQuery.data ?? []).map(p => ({ value: p.id, label: p.name, hint: p.code }))}
                 />
                 {(() => {
                   const selected = (carriersQuery.data ?? []).find(c => c.id === carrierFilter);
                    if (!selected || !selected.isBroker) return null;
                   const subs = (carriersQuery.data ?? []).filter(c => c.parentCompanyId === selected.id);
                   return <Autocomplete<CarrierDto, true> multiple size="small" options={subs} value={subs.filter(s => subCarrierFilter.includes(s.id))} onChange={(_, value) => setSubCarrierFilter(value.map(v => v.id))} getOptionLabel={(s) => s.name} isOptionEqualToValue={(a, b) => a.id === b.id} renderInput={(params) => <TextField {...params} label="Υποασφαλιστικές" size="small" />} />;
                 })()}
                 <TextField size="small" label="Αρ. κυκλοφορίας" value={plateFilter} onChange={(e) => setPlateFilter(e.target.value.toUpperCase())} />
                 <TextField size="small" label="Αρ. αίτησης" value={appNumberFilter} onChange={(e) => setAppNumberFilter(e.target.value)} />
                 <TextField size="small" type="number" label="Μεικτά από" value={premiumMin} onChange={(e) => setPremiumMin(e.target.value)} />
                 <TextField size="small" type="number" label="Μεικτά έως" value={premiumMax} onChange={(e) => setPremiumMax(e.target.value)} />
                 <SearchableTextField size="small" label="Πληρωμή" value={paymentRouteFilter} onChange={(e) => setPaymentRouteFilter(e.target.value as PaymentRoute)}>
                   <MenuItem value="">Όλες</MenuItem>
                   <MenuItem value="office">Πληρωμή στο γραφείο</MenuItem>
                   <MenuItem value="direct">Απευθείας στην ασφαλιστική</MenuItem>
                 </SearchableTextField>
               </Box>
             </DialogContent>
             <DialogActions>
               <Button color="error" variant="contained" onClick={clearPolicyFilters}>Καθαρισμός φίλτρων</Button>
               <Button variant="contained" onClick={() => setAdvancedFiltersOpen(false)}>Εφαρμογή</Button>
             </DialogActions>
           </Dialog>
           <Dialog open={quickFiltersOpen} onClose={() => setQuickFiltersOpen(false)} fullWidth maxWidth="md">
             <DialogTitle>Γρήγορα φίλτρα</DialogTitle>
             <DialogContent dividers>{policyQuickFilters}</DialogContent>
             <DialogActions><Button variant="contained" onClick={() => setQuickFiltersOpen(false)}>Κλείσιμο</Button></DialogActions>
           </Dialog>
         </>
       )}
       {false && !isCustomer && (
        <ResponsiveFilterPanel
          activeCount={policyFilterCount}
          title="Φίλτρα συμβολαίων"
          quickFilters={<QuickFilterBar
            activeCount={policyFilterCount}
            onClear={clearPolicyFilters}
            options={[
              { key: "all", label: "Όλα", active: policyFilterCount === 0, onClick: clearPolicyFilters },
              ...([5, 10, 20, 30, 60, 90] as const).map(days => ({
                key: `expiry-${days}`,
                label: `Λήγουν ≤${days} ημέρες`,
                active: expiryWindow === String(days),
                color: days <= 20 ? "error" as const : days <= 30 ? "warning" as const : "info" as const,
                onClick: () => { setExpiryWindow(String(days) as typeof expiryWindow); setStatusFilter("Active"); },
              })),
              { key: "prospects", label: "Πιθανά", active: statusFilter === "Prospect", color: "warning", onClick: () => { setExpiryWindow(""); setStatusFilter("Prospect"); } },
              { key: "direct", label: "Πληρώθηκαν απευθείας", active: paymentRouteFilter === "direct", color: "info", onClick: () => setPaymentRouteFilter("direct") },
              { key: "office", label: "Πληρωμή στο γραφείο", active: paymentRouteFilter === "office", onClick: () => setPaymentRouteFilter("office") },
            ]}
          />}
        >
          {/* Dense 4-col grid — search spans the full first row so it stays
              scannable, all other filters (~11) share the grid below so the
              whole block fits in 3–4 lines on desktop instead of six. */}
          <Box sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
            alignItems: "center",
          }}>
            <TextField
              size="small" fullWidth
              placeholder="Αναζήτηση: αρ. συμβολαίου, πελάτης, ΑΦΜ, πινακίδα…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ gridColumn: { xs: "1", sm: "1 / -1", md: "1 / -1" } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: <FilterHelp title="Αναζήτηση σε αριθμό συμβολαίου, πελάτη, ΑΦΜ, αρ. απόδειξης ή πινακίδα οχήματος." />
              }}
            />
            <SearchableTextField size="small" label={t("policies.col.status")} fullWidth
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PolicyStatus | "")}>
              <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
              {(["Prospect","Draft","Active","Expired","Cancelled","Renewed","PendingRenewal","Undelivered","AwaitingIssue"] as const).map(s =>
                <MenuItem key={s} value={s}>{s === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${s}`)}</MenuItem>)}
            </SearchableTextField>
            <SearchableTextField size="small" label={t("policies.col.type")} fullWidth
              value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PolicyType | "")}
              disabled={!carrierFilter}
              helperText={!carrierFilter
                ? "Επιλέξτε εταιρία"
                : filterCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}>
              <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
              {filterCatalogue.branches.map(b => (
                <MenuItem key={b.key} value={b.value}>{b.label}</MenuItem>
              ))}
            </SearchableTextField>
            <SearchableSelect
              label="Εταιρία"
              value={carrierFilter}
              onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); }}
              emptyLabel="Όλες"
              sx={{ width: "100%" }}
              options={(carriersQuery.data ?? [])
                .filter(c => !c.parentCompanyId)
                .map(c => ({
                  value: c.id,
                  label: c.name,
                  hint: c.isBroker ? "πρακτορείο" : c.code,
                }))}
            />
            <SearchableSelect
              label="Συνεργάτης"
              value={producerFilter}
              onChange={(v) => setProducerFilter(v)}
              emptyLabel="Όλοι"
              sx={{ width: "100%" }}
              options={(producersQuery.data ?? []).map(p => ({
                value: p.id, label: p.name, hint: p.code,
              }))}
            />
            {(() => {
              const selectedCarrier = (carriersQuery.data ?? []).find(c => c.id === carrierFilter);
              const selectedId = selectedCarrier?.id;
              if (!selectedCarrier?.isBroker || !selectedId) return null;
              const subs = (carriersQuery.data ?? []).filter(c => c.parentCompanyId === selectedId);
              return (
                <Autocomplete<CarrierDto, true>
                  multiple size="small"
                  options={subs}
                  value={subs.filter(s => subCarrierFilter.includes(s.id))}
                  onChange={(_, value) => setSubCarrierFilter(value.map(v => v.id))}
                  getOptionLabel={(s) => s.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => <TextField {...params} label="Υποασφαλιστικές" size="small" />}
                />
              );
            })()}
            <TextField size="small" type="date" label="Από" InputLabelProps={{ shrink: true }} fullWidth
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <TextField size="small" type="date" label="Έως" InputLabelProps={{ shrink: true }} fullWidth
              value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <TextField size="small" label="Αρ. κυκλοφορίας" fullWidth
              value={plateFilter}
              onChange={(e) => setPlateFilter(e.target.value.toUpperCase())} />
            <TextField size="small" label="Αρ. αίτησης" fullWidth
              value={appNumberFilter}
              onChange={(e) => setAppNumberFilter(e.target.value)} />
            <TextField size="small" type="number" label="Μικτά από" fullWidth
              value={premiumMin}
              onChange={(e) => setPremiumMin(e.target.value)} />
            <TextField size="small" type="number" label="Μικτά έως" fullWidth
              value={premiumMax}
              onChange={(e) => setPremiumMax(e.target.value)} />
            <SearchableTextField size="small" label="Πληρωμή" value={paymentRouteFilter}
              onChange={(e) => setPaymentRouteFilter(e.target.value as PaymentRoute)}>
              <MenuItem value="">Όλες</MenuItem>
              <MenuItem value="office">Πληρωμή στο γραφείο</MenuItem>
              <MenuItem value="direct">Απευθείας στην ασφαλιστική</MenuItem>
            </SearchableTextField>
            <Button size="small" fullWidth onClick={clearPolicyFilters} color="error" variant="contained">Καθαρισμός</Button>
          </Box>
        </ResponsiveFilterPanel>
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
              hideSearch
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
          {canEdit && selectedIds.size > 0 && (
            <Box sx={{ p: 1.5, mb: 2, bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 1,
                display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Typography fontWeight={700}>{selectedIds.size} επιλεγμένα συμβόλαια</Typography>
              <Box sx={{ flex: 1 }} />
              <Button variant="contained" color="secondary" onClick={() => setBulkOpen(true)}>
                Μαζική αλλαγή…
              </Button>
              <Button onClick={() => setSelectedIds(new Set())} color="error" variant="contained">Καθαρισμός</Button>
            </Box>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{
                  "& .MuiTableCell-root": {
                    bgcolor: "#eef1f4",
                    color: "#263238",
                    fontWeight: 800,
                    borderBottom: "2px solid #cfd8dc",
                  },
                }}>
                  {canEdit && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={rows.length > 0 && rows.every(r => selectedIds.has(r.id))}
                        indeterminate={rows.some(r => selectedIds.has(r.id)) && !rows.every(r => selectedIds.has(r.id))}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) rows.forEach(r => next.add(r.id));
                          else rows.forEach(r => next.delete(r.id));
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                  )}
                  {columnPrefs.visibleColumns.map(c => {
                    if (c.key === "customer" && isCustomer) return null;
                    const isRight = c.key === "premium";
                    return (
                      <TableCell
                        key={c.key}
                        align={isRight ? "right" : "left"}
                        onContextMenu={(e) => headerMenu.open(e, {
                          key: c.key, label: c.label, type: inferType(c.key), canHide: !c.alwaysVisible,
                        })}
                        sx={{ userSelect: "none" }}
                      >
                        {c.label}
                      </TableCell>
                    );
                  })}
                  {canEdit && (
                    <TableCell align="right" padding="checkbox">
                      <ColumnPreferencesButton
                        orderedColumns={columnPrefs.orderedColumns}
                        hiddenSet={columnPrefs.hiddenSet}
                        toggleVisibility={columnPrefs.toggleVisibility}
                        moveColumn={columnPrefs.moveColumn}
                        reset={columnPrefs.reset}
                      />
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => {
                  const daysToEnd = Math.ceil((new Date(p.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const expiringSoon = daysToEnd > 0 && daysToEnd <= 30 && p.status === "Active";
                  return (
                    <TableRow key={p.id} hover sx={p.status === "Prospect" ? {
                      cursor: "pointer",
                      bgcolor: "rgba(245, 158, 11, 0.12)",
                      "&:hover": { bgcolor: "rgba(245, 158, 11, 0.20)" }
                    } : { cursor: "pointer" }}
                      data-tour="policies-row"
                      selected={selectedIds.has(p.id)}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root, .MuiCheckbox-root")) return;
                        setDetailId(p.id);
                      }}
                      onContextMenu={(e) => rowMenu.open(e, p)}>
                      {canEdit && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selectedIds.has(p.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(p.id); else next.delete(p.id);
                              setSelectedIds(next);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                      )}
                      {columnPrefs.visibleColumns.map(c => {
                        if (c.key === "customer" && isCustomer) return null;
                        switch (c.key) {
                          case "number":
                            return <TableCell key={c.key}><Chip label={p.policyNumber} variant="outlined" size="small" /></TableCell>;
                          case "type":
                            return <TableCell key={c.key}>{t(`policies.types.${p.policyType}`)}</TableCell>;
                          case "customer":
                            return <TableCell key={c.key}><Typography fontWeight={600}>{p.customerDisplay}</Typography></TableCell>;
                          case "carrier":
                            return <TableCell key={c.key}>{p.insuranceCompanyName}</TableCell>;
                          case "producer":
                            return <TableCell key={c.key}>{p.producerName ?? "—"}</TableCell>;
                          case "dates":
                            return (
                              <TableCell key={c.key}>
                                <Typography variant="caption" color="text.secondary">Διάρκεια: {contractDurationLabel(p.startDate, p.endDate)}</Typography>
                                <Typography variant="body2">{date(p.startDate)} → {date(p.endDate)}</Typography>
                                {expiringSoon && (
                                  <Typography variant="caption" color="warning.main" fontWeight={700}>
                                    {t("policies.expiresIn", { days: daysToEnd })}
                                  </Typography>
                                )}
                              </TableCell>
                            );
                          case "premium":
                            return (
                              <TableCell key={c.key} align="right">
                                <Typography fontWeight={700}>{money(p.premium, p.currency)}</Typography>
                              </TableCell>
                            );
                          case "status":
                            return <TableCell key={c.key}><Chip data-tour="policies-status" label={p.status === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${p.status}`)} color={STATUS_COLOR[p.status]} size="small" /></TableCell>;
                          default:
                            return <TableCell key={c.key}>—</TableCell>;
                        }
                      })}
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
                              disabled={p.status === "Cancelled" || p.status === "Renewed" || p.status === "Prospect"}
                            >
                              <AutorenewIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => { if (confirm(t("policies.confirmCancel"))) cancelMutation.mutate(p.id); }}
                              title={t("policies.actions.cancel")}
                              disabled={p.status === "Cancelled" || p.status === "Prospect"}
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
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={table.filtered.length} pageSize={table.pageSize} />
          </Box>
        </Card>
      )}

      {/* The detail drawer is READ+edit-safe for every role that reaches
          this page (superadmin viewing an impersonated tenant, agency
          admin/user, customer). It was previously nested inside the
          `canEdit &&` block, which meant clicking a row as a viewer set
          detailId but the drawer wasn't even mounted — click did nothing.
          Now it lives at the top level so every role can preview a policy. */}
      <PolicyDetailDrawer
        policyId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        presentation="modal"
        readOnly={isProducer}
      />

      {canEdit && (
        <>
          <BulkImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            title="Μαζική εισαγωγή συμβολαίων"
            description="Κατεβάστε το πρότυπο XLSX και συμπληρώστε τα IDs πελάτη, ασφαλιστικής και προαιρετικά συνεργάτη. Κάθε γραμμή ελέγχεται ξεχωριστά πριν δημιουργηθεί το συμβόλαιο."
            columns={[...POLICY_IMPORT_COLUMNS]}
            onImport={importPolicies}
          />
          <PolicyFormDialog
            open={createStatus !== null}
            initialStatus={createStatus ?? "Active"}
            onClose={() => setCreateStatus(null)}
            policy={null}
            onSaved={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setCreateStatus(null); }}
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
          <BulkEditDialog
            open={bulkOpen}
            onClose={() => setBulkOpen(false)}
            selectedIds={Array.from(selectedIds)}
            onDone={() => { void qc.invalidateQueries({ queryKey: ["policies"] }); setSelectedIds(new Set()); setBulkOpen(false); }}
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
      {headerMenu.menu}
      {rowMenu.menu}
    </Box>
  );
}

/* ====================== Create/Edit dialog ====================== */

interface FormBody {
  customerId: string;
  policyNumber: string;
  insuranceCompanyId: string;
  producerId: string;
  policyType: PolicyType;
  vehicleUseCategory: string;
  coverCode: string;
  packageCode: string;
  startDate: string;
  endDate: string;
  premium: number;
  netPremium: string;
  specialCommissionPercent: string;
  insuranceTaxAmount: string;
  currency: string;
  status: PolicyStatus;
  paidDirectlyToCarrier: boolean;
  delivered: boolean;
}

function PolicyFormDialog({
  open,
  initialStatus = "Active",
  onClose,
  policy,
  onSaved
}: {
  open: boolean;
  initialStatus?: PolicyStatus;
  onClose: () => void;
  policy: PolicyDto | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const editing = !!policy;

  // Full server-side customer search (ΑΦΜ / κινητό / email / όνομα κ.λπ.) —
  // no more «τα πρώτα 500» wall. See useCustomerSearch for the debounce +
  // selected-customer inclusion logic.
  const customerSearch = useCustomerSearch(null);
  // Non-null string = inline "new customer" dialog open (with that string
  // as the prefill). Null = closed. Kept as a separate state so the parent
  // dialog stays interactive underneath.
  const [inlineCustomerCreate, setInlineCustomerCreate] = useState<string | null>(null);
  const [inlineCarrierCreate, setInlineCarrierCreate] = useState<string | null>(null);
  const carriersQuery = useQuery({
    queryKey: ["insurance-companies-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data,
    enabled: open
  });
  // Producer list for the «Συνεργάτης» dropdown — local to the dialog so
  // it opens/closes with the form; not shared with the parent page which
  // has its own producers-for-filter query keyed differently.
  const producersQuery = useQuery({
    queryKey: ["producers-for-policy-form"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data,
    enabled: open,
  });

  const [form, setForm] = useState<FormBody>({
    customerId: "",
    policyNumber: "",
    insuranceCompanyId: "",
    producerId: "",
    policyType: "Auto",
    vehicleUseCategory: "",
    coverCode: "",
    packageCode: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    premium: 0,
    netPremium: "",
    specialCommissionPercent: "",
    insuranceTaxAmount: "",
    currency: "EUR",
    status: "Active",
    paidDirectlyToCarrier: false,
    delivered: true
  });
  const [error, setError] = useState<string | null>(null);
  const dialogCatalogue = useCarrierCatalogue(form.insuranceCompanyId);
  // Auto-save the new-policy draft to localStorage so a lost tab or
  // accidental close leaves the operator right where they were. Only
  // active for CREATE (editing an existing policy shouldn't accidentally
  // overwrite a stashed draft from a different day).
  const { clearDraft, hasDraft } = useDraftPersistence<FormBody>(
    "policy-new", user?.userId ?? null, form, setForm, open && !editing);

  useEffect(() => {
    if (policy) {
      setForm({
        customerId: policy.customerId,
        policyNumber: policy.policyNumber,
        insuranceCompanyId: policy.insuranceCompanyId,
        producerId: policy.producerId ?? "",
        policyType: policy.policyType,
        vehicleUseCategory: "",
        coverCode: "",
        packageCode: "",
        startDate: policy.startDate,
        endDate: policy.endDate,
        premium: policy.premium,
        netPremium: "",
        specialCommissionPercent: "",
        insuranceTaxAmount: "",
        currency: policy.currency,
        status: policy.status,
        paidDirectlyToCarrier: policy.paidDirectlyToCarrier ?? false,
        delivered: !!policy.deliveredAt
      });
    } else if (open) {
      setForm({
        customerId: "",
        policyNumber: "",
        insuranceCompanyId: "",
        producerId: "",
        policyType: "Auto",
        vehicleUseCategory: "",
        coverCode: "",
        packageCode: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
        premium: 0,
        netPremium: "",
        specialCommissionPercent: "",
        insuranceTaxAmount: "",
        currency: "EUR",
        status: initialStatus,
        paidDirectlyToCarrier: false,
        delivered: true
      });
    }
  }, [policy, open, initialStatus]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build the API payload explicitly.  Do not spread `form` here: the form
      // contains UI-only fields (notably `insuranceTaxAmount`) whose names do
      // not exist on CreatePolicyBody/UpdatePolicyBody.  The API deliberately
      // rejects unmapped JSON properties, so spreading the form made every
      // manual policy create fail with a generic 400 validation response.
      const taxAmount = form.insuranceTaxAmount !== ""
        ? Number(form.insuranceTaxAmount)
        : (form.netPremium !== "" && form.premium > 0
          ? Math.max(0, form.premium - Number(form.netPremium)) : null);
      const body = {
        insuranceCompanyId: form.insuranceCompanyId,
        producerId: form.producerId || null,
        policyType: form.policyType,
        vehicleUseCategory: form.vehicleUseCategory || null,
        coverCode: form.coverCode || null,
        packageCode: form.packageCode || null,
        startDate: form.startDate,
        endDate: form.endDate,
        premium: form.premium,
        netPremium: form.netPremium === "" ? null : Number(form.netPremium),
        specialCommissionPercent: form.specialCommissionPercent === "" ? null : Number(form.specialCommissionPercent),
        vatAmount: taxAmount,
        currency: form.currency,
        status: form.status,
        paidDirectlyToCarrier: form.paidDirectlyToCarrier,
        delivered: form.delivered,
      };
      if (editing && policy) {
        return (await api.put<PolicyDto>(`/policies/${policy.id}`, body)).data;
      } else {
        return (await api.post<PolicyDto>("/policies", {
          customerId: form.customerId,
          policyNumber: form.policyNumber.trim() || null,
          ...body,
        })).data;
      }
    },
    onSuccess: () => { clearDraft(); onSaved(); },
    onError: (err) => { clearDraft(); setError(extractErrorMessage(err)); }
  });

  // customer options come from useCustomerSearch (server-side filtered).

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t("policies.form.editTitle") : t("policies.form.createTitle")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {!editing && hasDraft && (
          <Alert severity="info" sx={{ mb: 2 }} action={
            <Button size="small" onClick={() => { clearDraft(); window.location.reload(); }} color="error" variant="contained">Καθαρισμός</Button>
          }>
            Επαναφέραμε τα δεδομένα από την προηγούμενη σύνοδο.
          </Alert>
        )}
        <Stack spacing={2.5} mt={1}>
          <TextField label="Αριθμός συμβολαίου" value={form.policyNumber}
            onChange={e => setForm({ ...form, policyNumber: e.target.value })}
            placeholder="Κενό = αυτόματη αρίθμηση (P-000001)"
            helperText="Για χειροκίνητη καταχώρηση" fullWidth />
          <SearchableSelect
            label={t("policies.form.customer")}
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
            onInputChange={customerSearch.setInput}
            required disabled={editing}
            helperText={editing ? t("policies.form.customerLocked") : "Πληκτρολογήστε ΑΦΜ, όνομα, κινητό ή email"}
            options={customerSearch.options}
            createNewLabel="+ Νέος πελάτης"
            onCreateNew={editing ? undefined : (input) => setInlineCustomerCreate(input || "")}
          />
          <InlineCreateCustomerDialog
            open={inlineCustomerCreate !== null}
            prefillText={inlineCustomerCreate ?? ""}
            defaultStatus={form.status === "Prospect" ? "Prospect" : "Active"}
            onClose={() => setInlineCustomerCreate(null)}
            onCreated={(c) => {
              // Feed the new id into the parent form so it's already selected
              // the moment the dropdown re-reads its options.
              setForm(prev => ({ ...prev, customerId: c.id }));
              customerSearch.setInput(c.displayName);
              setInlineCustomerCreate(null);
            }}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("policies.form.carrier")}
              value={form.insuranceCompanyId}
              onChange={(v) => setForm({ ...form, insuranceCompanyId: v, policyType: "Auto", vehicleUseCategory: "", coverCode: "", packageCode: "" })}
              required
              options={(carriersQuery.data ?? []).filter(c => !c.parentCompanyId).map(c => ({
                value: c.id,
                label: c.name,
                hint: c.isBroker ? "πρακτορείο" : undefined,
              }))}
              createNewLabel="+ Νέα ασφαλιστική"
              onCreateNew={editing ? undefined : (input) => setInlineCarrierCreate(input || "")}
            />
            <InlineCreateInsuranceCompanyDialog
              open={inlineCarrierCreate !== null}
              prefillText={inlineCarrierCreate ?? ""}
              onClose={() => setInlineCarrierCreate(null)}
              onCreated={(c) => { setForm(prev => ({ ...prev, insuranceCompanyId: c.id, policyType: "Auto", vehicleUseCategory: "", coverCode: "", packageCode: "" })); setInlineCarrierCreate(null); }}
            />
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
                <SearchableSelect
                  label="Υποασφαλιστική"
                  value={subValue}
                  onChange={(v) => setForm({ ...form, insuranceCompanyId: v || broker.id, vehicleUseCategory: "", coverCode: "", packageCode: "" })}
                  emptyLabel="— επιλέξτε υποασφαλιστική —"
                  options={subs.map(s => ({ value: s.id, label: s.name }))}
                />
              );
            })()}
          </Stack>

          {/* Producer picker — optional but recommended. Blank leaves the
              policy «ασύνδετο»; picking one lets the bridge auto-inherit
              on next renewal via the same policy number. */}
          <SearchableSelect
            label="Συνεργάτης"
            value={form.producerId}
            onChange={(v) => setForm({ ...form, producerId: v })}
            emptyLabel="— Παραγωγή γραφείου · χωρίς συνεργάτη —"
            options={(producersQuery.data ?? []).map(p => ({
              value: p.id,
              label: p.code ? `${p.code} — ${p.name}` : p.name,
            }))}
            helperText="Αφήστε το κενό για παραγωγή γραφείου: η έδρα λαμβάνει όλη την προμήθεια της ασφαλιστικής. Με συνεργάτη, η προμήθειά του αφαιρείται από το συνολικό ποσοστό."
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label={t("policies.form.type")}
              value={form.policyType}
              onChange={(v) => setForm({ ...form, policyType: v as PolicyType })}
              required
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία πρώτα"
                : dialogCatalogue.branches.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              options={dialogCatalogue.branches.map(b => ({ value: b.value, label: b.label }))}
            />
            <SearchableSelect
              label="Χρήση οχήματος"
              value={form.vehicleUseCategory}
              onChange={(v) => setForm({ ...form, vehicleUseCategory: v })}
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="—"
              options={dialogCatalogue.uses.map(u => ({ value: u.value, label: u.label }))}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <SearchableSelect
              label="Κάλυψη"
              value={form.coverCode}
              onChange={(v) => setForm({ ...form, coverCode: v })}
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικά" : ""}
              emptyLabel="—"
              options={dialogCatalogue.coverages.map(c => ({ value: c.value, label: c.label }))}
            />
            <SearchableSelect
              label="Πακέτο"
              value={form.packageCode}
              onChange={(v) => setForm({ ...form, packageCode: v })}
              disabled={!form.insuranceCompanyId}
              helperText={!form.insuranceCompanyId
                ? "Επιλέξτε εταιρία"
                : dialogCatalogue.packages.length === 0 ? "Δεν υπάρχουν πακέτα" : ""}
              emptyLabel="—"
              options={dialogCatalogue.packages.map(p => ({ value: p.value, label: p.label }))}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField type="number" label="Καθαρά ασφάλιστρα" value={form.netPremium}
              onChange={e => setForm({ ...form, netPremium: e.target.value })}
              helperText="Κενό = υπολογισμός από μικτά / κανόνες" fullWidth />
            <TextField type="number" label="Προμήθεια συνεργάτη %" value={form.specialCommissionPercent}
              onChange={e => setForm({ ...form, specialCommissionPercent: e.target.value })}
              helperText="Κενό = χρήση κανόνα προμηθειών" fullWidth />
            <TextField type="number" label="Φόρος ασφαλίστρων €" value={form.insuranceTaxAmount}
              onChange={e => setForm({ ...form, insuranceTaxAmount: e.target.value })}
              helperText="Όχι ΦΠΑ — ειδικός φόρος ασφαλίστρων" fullWidth />
          </Stack>
          {(() => {
            const gross = Number(form.premium) || 0;
            const net = Number(form.netPremium) || 0;
            const tax = gross > 0 && net > 0 ? Math.max(0, gross - net) : null;
            const producerPct = Number(form.specialCommissionPercent);
            const producerAmount = form.producerId && tax !== null && producerPct > 0 ? net * producerPct / 100 : null;
            return (tax !== null || producerAmount !== null) ? (
              <Alert severity="info">
                <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                  {tax !== null && <span><strong>Φόρος ασφαλίστρων:</strong> {tax.toFixed(2)} €</span>}
                  {producerAmount !== null && <span><strong>Προμήθεια συνεργάτη:</strong> {producerAmount.toFixed(2)} € ({producerPct.toFixed(2)}% επί καθαρών)</span>}
                  {producerAmount !== null && <span><strong>Έδρα:</strong> υπολογίζεται από το συνολικό ποσοστό ασφαλιστικής μείον την προμήθεια συνεργάτη.</span>}
                </Stack>
              </Alert>
            ) : null;
          })()}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
              value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              fullWidth required
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία έναρξης ισχύος συμβολαίου. Καθορίζει και πότε αρχίζει η προμήθεια συνεργάτη." /> }}
            />
            <TextField
              type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
              value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              fullWidth required
              InputProps={{ endAdornment: <FilterHelp title="Ημερομηνία λήξης συμβολαίου. Χρησιμοποιείται στις ειδοποιήσεις ανανέωσης." /> }}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="number" label={t("policies.form.premium")}
              value={form.premium}
              onChange={(e) => setForm({ ...form, premium: Number(e.target.value) })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {form.currency}
                    <FilterHelp title="Μικτό ασφάλιστρο συμβολαίου. Τα ασφαλιστήρια δεν έχουν ΦΠΑ· τυχόν επιβάρυνση καταχωρείται ως φόρος ασφαλίστρων." />
                  </InputAdornment>
                )
              }}
              fullWidth required
            />
            <SearchableTextField
              select label={t("policies.col.status")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as PolicyStatus })}
              fullWidth
            >
              {(["Prospect","Draft","AwaitingIssue","Active","Undelivered","PendingRenewal","Expired","Cancelled","Renewed"] as const).map(s =>
                <MenuItem key={s} value={s}>{s === "Prospect" ? "Πιθανό συμβόλαιο" : t(`policies.statuses.${s}`)}</MenuItem>
              )}
            </SearchableTextField>
          </Stack>
          <FormControlLabel
            control={<Checkbox checked={form.paidDirectlyToCarrier}
              onChange={e => setForm({ ...form, paidDirectlyToCarrier: e.target.checked })} />}
            label="Ο πελάτης πλήρωσε απευθείας στην ασφαλιστική"
          />
          <FormControlLabel
            control={<Checkbox checked={form.delivered}
              onChange={e => setForm({ ...form, delivered: e.target.checked })} />}
            label="Παραδόθηκε"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
            Δεν δημιουργείται είσπραξη στο ταμείο του γραφείου και η οφειλή προς την ασφαλιστική εξαιρείται από τις εκκρεμείς πληρωμές.
          </Typography>
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
  // Optional overrides for the new policy — leaving any of these blank
  // keeps the source policy's value. Covers the common «I need to tweak
  // the coverage/producer/plate before ανανέωση» flow so the operator
  // doesn't have to re-open the new policy in edit mode.
  const [producerIdOverride, setProducerIdOverride] = useState<string>("");
  const [vehicleUse, setVehicleUse] = useState<string>("");
  const [coverCode, setCoverCode] = useState<string>("");
  const [packageCode, setPackageCode] = useState<string>("");
  const [applicationNumber, setApplicationNumber] = useState<string>("");
  const [plate, setPlate] = useState<string>("");
  const [specialCommissionPercent, setSpecialCommissionPercent] = useState<string>("");
  const [showExtras, setShowExtras] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrier catalogue — drives Κάλυψη / Πακέτο / Χρήση οχήματος dropdowns
  // for the source policy's carrier so overrides stay in-parametric.
  const catalogue = useCarrierCatalogue(policy?.insuranceCompanyId ?? "");

  const producersQ = useQuery({
    queryKey: ["producers-for-renew"],
    queryFn: async () => (await api.get<{ id: string; name: string; code: string }[]>("/producers")).data,
    enabled: !!policy
  });

  useEffect(() => {
    if (policy) {
      const nextStart = policy.endDate;
      const nextEnd = new Date(new Date(policy.endDate).getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      setPremium(policy.premium);
      // Overrides start blank — «leave alone» is the safe default.
      setProducerIdOverride("");
      setVehicleUse("");
      setCoverCode("");
      setPackageCode("");
      setApplicationNumber("");
      setPlate("");
      setSpecialCommissionPercent("");
      setShowExtras(false);
    }
  }, [policy?.id, policy?.endDate, policy?.premium]);

  const mutation = useMutation({
    mutationFn: async () => (await api.post<PolicyDto>(`/policies/${policy!.id}/renew`, {
      startDate, endDate, premium,
      producerId: producerIdOverride || null,
      vehicleUseCategory: vehicleUse || null,
      coverCode: coverCode.trim() || null,
      packageCode: packageCode.trim() || null,
      applicationNumber: applicationNumber.trim() || null,
      vehicleRegistrationPlate: plate.trim() || null,
      specialCommissionPercent: specialCommissionPercent.trim()
        ? Number(specialCommissionPercent)
        : null,
    })).data,
    onSuccess: onSaved,
    onError: (err) => setError(extractErrorMessage(err))
  });

  return (
    <Dialog open={!!policy} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("policies.renew.title")}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("policies.renew.body", { num: policy?.policyNumber ?? "" })}
        </Typography>
        <Stack spacing={2.5}>
          <Divider />
          <TextField type="date" label={t("policies.form.startDate")} InputLabelProps={{ shrink: true }}
            value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth required
            InputProps={{ endAdornment: <FilterHelp title="Νέα ημερομηνία έναρξης — συνήθως η αμέσως επόμενη μέρα από τη λήξη του παλιού συμβολαίου." /> }} />
          <TextField type="date" label={t("policies.form.endDate")} InputLabelProps={{ shrink: true }}
            value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth required
            InputProps={{ endAdornment: <FilterHelp title="Νέα ημερομηνία λήξης — συνήθως ένα έτος μετά τη νέα έναρξη." /> }} />
          <TextField type="number" label={t("policies.form.premium")}
            value={premium} onChange={(e) => setPremium(Number(e.target.value))}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {policy?.currency ?? "EUR"}
                  <FilterHelp title="Ασφάλιστρο ανανεωμένου συμβολαίου. Προσυμπληρώνεται με το προηγούμενο — μπορείτε να το αλλάξετε." />
                </InputAdornment>
              )
            }}
            fullWidth required />

          <Button size="small" variant="text" onClick={() => setShowExtras(x => !x)}
            sx={{ alignSelf: "flex-start" }}>
            {showExtras ? "− Απόκρυψη επιπλέον λεπτομερειών" : "+ Επιπλέον λεπτομέρειες (καλύψεις, χρήση, προμήθεια)"}
          </Button>

          {showExtras && (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Αφήστε κενό όποιο πεδίο θέλετε να παραμείνει όπως ήταν στο αρχικό συμβόλαιο.
              </Alert>
              <SearchableSelect
                label="Συνεργάτης (μεταφορά)" value={producerIdOverride}
                onChange={setProducerIdOverride}
                emptyLabel="— διατήρηση —"
                options={(producersQ.data ?? []).map(p => ({
                  value: p.id, label: p.name, hint: p.code,
                }))}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <SearchableTextField label="Χρήση οχήματος" value={vehicleUse}
                  onChange={(e) => setVehicleUse(e.target.value)} fullWidth
                  disabled={catalogue.uses.length === 0}
                  helperText={catalogue.uses.length === 0 ? "Δεν υπάρχουν παραμετρικά χρήσης" : ""}>
                  <MenuItem value="">— διατήρηση —</MenuItem>
                  {catalogue.uses.map(u => <MenuItem key={u.key} value={u.value}>{u.label}</MenuItem>)}
                </SearchableTextField>
                <SearchableTextField label="Κάλυψη" value={coverCode}
                  onChange={(e) => setCoverCode(e.target.value)} fullWidth
                  disabled={catalogue.coverages.length === 0}
                  helperText={catalogue.coverages.length === 0 ? "Δεν υπάρχουν παραμετρικές καλύψεις" : ""}>
                  <MenuItem value="">— διατήρηση —</MenuItem>
                  {catalogue.coverages.map(c => <MenuItem key={c.key} value={c.value}>{c.label}</MenuItem>)}
                </SearchableTextField>
              </Stack>
              <SearchableTextField label="Πακέτο" value={packageCode}
                onChange={(e) => setPackageCode(e.target.value)} fullWidth
                disabled={catalogue.packages.length === 0}
                helperText={catalogue.packages.length === 0 ? "Δεν υπάρχουν παραμετρικά πακέτα" : ""}>
                <MenuItem value="">— διατήρηση —</MenuItem>
                {catalogue.packages.map(p => <MenuItem key={p.key} value={p.value}>{p.label}</MenuItem>)}
              </SearchableTextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Αρ. αίτησης" fullWidth
                  value={applicationNumber}
                  onChange={(e) => setApplicationNumber(e.target.value)} />
                <TextField label="Αρ. κυκλοφορίας" fullWidth
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())} />
              </Stack>
              <TextField
                type="number" label="Ειδική προμήθεια συνεργάτη (%)"
                value={specialCommissionPercent}
                onChange={(e) => setSpecialCommissionPercent(e.target.value)}
                inputProps={{ step: "0.01", min: 0, max: 100 }}
                helperText="Παρακάμπτει την προμήθεια του CommissionRule. Άδειο = χρήση παραμετροποίησης."
                fullWidth />
            </Stack>
          )}
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

/**
 * Bulk-edit dialog for the Policies table selection toolbar. Every field
 * is optional — leaving a field empty keeps its existing value on each
 * selected policy. Applies via POST /policies/bulk-update; the handler
 * validates tenant scope and skips silently for any id that isn't
 * touchable so a bad payload can't cross-tenant leak.
 */
function BulkEditDialog({
  open, onClose, selectedIds, onDone
}: {
  open: boolean; onClose: () => void; selectedIds: string[]; onDone: () => void;
}) {
  const producersQ = useQuery({
    queryKey: ["producers-for-bulk"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/producers")).data,
    enabled: open
  });
  const carriersQ = useQuery({
    queryKey: ["insurance-companies-lite-used"],
    queryFn: async () => (await api.get<CarrierDto[]>("/insurance-companies", { params: { onlyUsed: true } })).data,
    enabled: open
  });
  const [producerId, setProducerId] = useState<string>("");
  const [renewalToProducerId, setRenewalToProducerId] = useState<string>("");
  const [renewalToCarrierId, setRenewalToCarrierId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ updatedCount: number; skippedCount: number } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: async () => (await api.post<{ updatedCount: number; skippedCount: number }>(
      "/policies/bulk-update", {
        policyIds: selectedIds,
        producerId: producerId || null,
        renewalTransferToProducerId: renewalToProducerId || null,
        renewalTransferToCarrierId: renewalToCarrierId || null,
        status: status || null,
        paymentCollectionMethod: null,
      })).data,
    onSuccess: setResult,
    onError: (e) => setErr(extractErrorMessage(e))
  });

  const anyChange = producerId || renewalToProducerId || renewalToCarrierId || status;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Μαζική αλλαγή σε {selectedIds.length} συμβόλαια</DialogTitle>
      <DialogContent>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Ενημερώθηκαν {result.updatedCount} συμβόλαια
            {result.skippedCount > 0 ? `, ${result.skippedCount} παραλείφθηκαν` : ""}.
          </Alert>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          Πεδία που αφήνετε κενά δεν αλλάζουν στα επιλεγμένα συμβόλαια.
        </Alert>
        <Stack spacing={2}>
          <SearchableSelect label="Νέος συνεργάτης" value={producerId} onChange={setProducerId}
            emptyLabel="— δεν αλλάζει —"
            options={(producersQ.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <SearchableSelect label="Μεταφορά ανανέωσης · Συνεργάτης" value={renewalToProducerId} onChange={setRenewalToProducerId}
            emptyLabel="— δεν αλλάζει —"
            options={(producersQ.data ?? []).map(p => ({ value: p.id, label: p.name }))} />
          <SearchableSelect label="Μεταφορά ανανέωσης · Ασφαλιστική" value={renewalToCarrierId} onChange={setRenewalToCarrierId}
            emptyLabel="— δεν αλλάζει —"
            options={(carriersQ.data ?? []).filter(c => !c.parentCompanyId).map(c => ({ value: c.id, label: c.name }))} />
          <SearchableSelect label="Κατάσταση" value={status} onChange={setStatus}
            emptyLabel="— δεν αλλάζει —"
            options={["Prospect", "Active", "Draft", "Expired", "Cancelled", "Renewed", "PendingRenewal"]
              .map(s => ({ value: s, label: s === "Prospect" ? "Πιθανό συμβόλαιο" : s }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setResult(null); setErr(null); onClose(); }} color="error" variant="contained">{result ? "Κλείσιμο" : "Άκυρο"}</Button>
        {result ? (
          <Button variant="contained" onClick={onDone}>Ανανέωση λίστας</Button>
        ) : (
          <Button variant="contained" onClick={() => bulkMutation.mutate()}
            disabled={!anyChange || bulkMutation.isPending}>
            {bulkMutation.isPending ? <CircularProgress size={18} /> : `Εφαρμογή σε ${selectedIds.length}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
