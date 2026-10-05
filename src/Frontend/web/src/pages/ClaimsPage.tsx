import { useEffect, useMemo, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp } from "../components/FilterHelp";
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
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import TuneIcon from "@mui/icons-material/Tune";
import { ExcelImportButton } from "../components/ExcelImportButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { money, date } from "../utils/format";
import { useAuth } from "../auth/AuthContext";
import { api, extractErrorMessage } from "../api/client";
import { ClaimDetailDrawer } from "../components/ClaimDetailDrawer";
import { useTableState } from "../components/useTableState";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { SearchableSelect } from "../components/SearchableSelect";
import { SearchableTextField } from "../components/SearchableTextField";
import { useCarrierCatalogue } from "../hooks/useCarrierCatalogue";
import { QuickFilterBar } from "../components/QuickFilterBar";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { BulkImportDialog, type BulkImportColumn, type BulkImportResult } from "../components/BulkImportDialog";

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

const CLAIM_IMPORT_COLUMNS: BulkImportColumn[] = [
  { key: "policyId", label: "ID συμβολαίου", required: true, example: "00000000-0000-0000-0000-000000000000" },
  { key: "incidentDate", label: "Ημερομηνία ζημιάς (YYYY-MM-DD)", required: true, example: "2026-10-01" },
  { key: "reportedDate", label: "Ημερομηνία δήλωσης (YYYY-MM-DD)", example: "2026-10-02" },
  { key: "claimedAmount", label: "Αιτούμενο ποσό", example: "1500.00" },
  { key: "description", label: "Περιγραφή", example: "Περιγραφή ζημιάς" },
];

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
  const canEdit = user?.role === "AgencyAdmin" || user?.role === "AgencyOfficeAdmin" || user?.role === "AgencyUser";

  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
  const [dateWindow, setDateWindow] = useState<"" | "7" | "30" | "90">("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(false);

  const importClaims = async (rows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0;
    const errors: string[] = [];
    const failedRows: Record<string, string>[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      try {
        const incidentDate = row.incidentDate?.trim();
        if (!row.policyId?.trim() || !incidentDate) throw new Error("Λείπει ID συμβολαίου ή ημερομηνία ζημιάς.");
        const amount = row.claimedAmount?.trim();
        const claimedAmount = amount ? Number(amount.replace(",", ".")) : null;
        if (claimedAmount !== null && !Number.isFinite(claimedAmount)) throw new Error("Το αιτούμενο ποσό δεν είναι αριθμός.");
        await api.post("/claims", {
          policyId: row.policyId.trim(),
          incidentDate,
          reportedDate: row.reportedDate?.trim() || new Date().toISOString().slice(0, 10),
          claimedAmount,
          description: row.description?.trim() || null,
        });
        imported += 1;
      } catch (error) {
        failedRows.push(row);
        errors.push(`Γραμμή ${index + 2}: ${extractErrorMessage(error, "Αποτυχία εισαγωγής ζημιάς")}`);
      }
    }
    return { imported, failed: failedRows.length, errors, failedRows };
  };

  const carriersQ = useQuery({
    queryKey: ["carriers-claims-filter"],
    queryFn: async () => (await api.get<{ id: string; name: string; isBroker?: boolean; parentCompanyId?: string | null }[]>(
      "/insurance-companies", { params: { onlyUsed: true } })).data
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
    if (dateWindow) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(start.getDate() - Number(dateWindow) + 1);
      if (c.incidentDate < start.toISOString().slice(0, 10) || c.incidentDate > today.toISOString().slice(0, 10)) return false;
    }
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
  const clearClaimFilters = () => {
    setStatusFilter(""); setCustomerFilter(""); setCarrierFilter(""); setSubCarrierFilter([]);
    setTypeFilter(""); setUseFilter(""); setCoverFilter(""); setPackageFilter("");
    setFromDate(""); setToDate(""); setDateWindow("");
    table.setQuery(""); table.setPage(1);
  };
  const claimFilterCount = [
    statusFilter, customerFilter, carrierFilter, typeFilter, useFilter, coverFilter,
    packageFilter, fromDate, toDate, dateWindow, table.query,
  ].filter(Boolean).length;

  // Right-click on a header → sort by that column. On a row → open edit.
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ClaimDto> = {
        number: "claimNumber", policy: "policyNumber", customer: "customerDisplay",
        incidentDate: "incidentDate", claimed: "claimedAmount", approved: "approvedAmount",
        status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
  });
  const inferType = (key: string): ColumnType =>
    key === "incidentDate" ? "date" : (key === "claimed" || key === "approved") ? "number" : "string";
  const rowMenu = useRowContextMenu<ClaimDto>({
    entityLabel: "ζημιάς",
    onEdit: (c) => setEditing(c),
  });

  const claimQuickFilters = (
    <QuickFilterBar
      activeCount={claimFilterCount}
      onClear={clearClaimFilters}
      options={[
        { key: "all", label: "Όλες", active: claimFilterCount === 0, onClick: clearClaimFilters },
        { key: "open", label: "Ανοιχτές", active: statusFilter === "Reported" || statusFilter === "UnderReview", color: "warning", onClick: () => { setDateWindow(""); setStatusFilter("UnderReview"); setQuickFiltersOpen(false); } },
        ...(["7", "30", "90"] as const).map(days => ({ key: days, label: `Τελευταίες ${days} ημέρες`, active: dateWindow === days, color: "info" as const, onClick: () => { setDateWindow(days); setQuickFiltersOpen(false); } })),
        { key: "paid", label: "Πληρωμένες", active: statusFilter === "Paid", color: "success", onClick: () => { setDateWindow(""); setStatusFilter("Paid"); setQuickFiltersOpen(false); } },
      ]}
    />
  );

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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <ExcelImportButton size="large" onClick={() => setImportOpen(true)}>
              Μαζική εισαγωγή
            </ExcelImportButton>
            <Button data-tour="claims-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateOpen(true); }}>
              {t("claims.create")}
            </Button>
          </Stack>
        )}
      </Stack>

      {!isCustomer && (
        <>
          <Card variant="outlined" sx={{ p: 1, mb: 2 }}>
            <Box sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(4, minmax(0, 1fr))",
                md: "minmax(220px, 1.4fr) 120px 120px auto auto",
                lg: "minmax(240px, 1.4fr) 125px 125px auto auto",
              },
              gap: 0.75,
              alignItems: "center",
            }}>
              <TextField
                size="small"
                fullWidth
                label="Πελάτης / συμβόλαιο / ΑΦΜ"
                placeholder="Αναζήτηση…"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                sx={{ minWidth: 0, gridColumn: { xs: "auto", sm: "span 2", md: "auto", lg: "auto" } }}
                InputProps={{ endAdornment: <FilterHelp title="Αναζήτηση σε ονοματεπώνυμο πελάτη, αριθμό συμβολαίου ή ΑΦΜ." /> }}
              />
              <TextField size="small" type="date" label="Συμβάν από" InputLabelProps={{ shrink: true }} fullWidth value={fromDate} onChange={(e) => setFromDate(e.target.value)} sx={{ minWidth: 0, width: "100%" }} />
              <TextField size="small" type="date" label="Συμβάν έως" InputLabelProps={{ shrink: true }} fullWidth value={toDate} onChange={(e) => setToDate(e.target.value)} sx={{ minWidth: 0, width: "100%" }} />
              <Button size="small" variant={claimFilterCount > 0 ? "contained" : "outlined"} startIcon={<TuneIcon />} onClick={() => setAdvancedFiltersOpen(true)} sx={{ whiteSpace: "nowrap", bgcolor: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9", "&:hover": { bgcolor: "#bbdefb", borderColor: "#64b5f6", color: "#0d47a1" } }}>
                Σύνθετα φίλτρα{claimFilterCount > 0 ? ` (${claimFilterCount})` : ""}
              </Button>
              <Button size="small" variant="outlined" startIcon={<FilterAltIcon />} onClick={() => setQuickFiltersOpen(true)} sx={{ whiteSpace: "nowrap", bgcolor: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9", "&:hover": { bgcolor: "#bbdefb", borderColor: "#64b5f6", color: "#0d47a1" } }}>
                Γρήγορα φίλτρα
              </Button>
            </Box>
          </Card>
          <Dialog open={advancedFiltersOpen} onClose={() => setAdvancedFiltersOpen(false)} fullWidth maxWidth="md">
            <DialogTitle>Σύνθετα φίλτρα ζημιών</DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, pt: .5 }}>
                <SearchableTextField size="small" label={t("claims.col.status")} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "")}>
                  <MenuItem value="">Όλες οι καταστάσεις</MenuItem>
                  {(["Reported", "UnderReview", "Approved", "Rejected", "Paid", "Closed"] as const).map(s => <MenuItem key={s} value={s}>{t(`claims.statuses.${s}`)}</MenuItem>)}
                </SearchableTextField>
                <SearchableSelect label="Εταιρία" value={carrierFilter} onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); setUseFilter(""); setCoverFilter(""); setPackageFilter(""); }} emptyLabel="Όλες" options={(carriersQ.data ?? []).filter(c => !c.parentCompanyId).map(c => ({ value: c.id, label: c.name, hint: c.isBroker ? "Πρακτορείο" : undefined }))} />
                <SearchableSelect label="Κλάδος" value={typeFilter} onChange={(v) => setTypeFilter(v)} disabled={!carrierFilter} emptyLabel="Όλοι" options={filterCatalogue.branches.map(b => ({ value: b.value, label: b.label }))} />
                <SearchableSelect label="Χρήση οχήματος" value={useFilter} onChange={(v) => setUseFilter(v)} disabled={!carrierFilter} emptyLabel="Όλες" options={filterCatalogue.uses.map(u => ({ value: u.value, label: u.label }))} />
                <SearchableSelect label="Κάλυψη" value={coverFilter} onChange={(v) => setCoverFilter(v)} disabled={!carrierFilter} emptyLabel="Όλες" options={filterCatalogue.coverages.map(c => ({ value: c.value, label: c.label }))} />
                <SearchableSelect label="Πακέτο" value={packageFilter} onChange={(v) => setPackageFilter(v)} disabled={!carrierFilter} emptyLabel="Όλα" options={filterCatalogue.packages.map(p => ({ value: p.value, label: p.label }))} />
              </Box>
            </DialogContent>
            <DialogActions><Button color="error" variant="contained" onClick={clearClaimFilters}>Καθαρισμός φίλτρων</Button><Button variant="contained" onClick={() => setAdvancedFiltersOpen(false)}>Εφαρμογή</Button></DialogActions>
          </Dialog>
          <Dialog open={quickFiltersOpen} onClose={() => setQuickFiltersOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Γρήγορα φίλτρα</DialogTitle>
            <DialogContent dividers>{claimQuickFilters}</DialogContent>
            <DialogActions><Button variant="contained" onClick={() => setQuickFiltersOpen(false)}>Κλείσιμο</Button></DialogActions>
          </Dialog>
        </>
      )}
      {false && !isCustomer && (
        <ResponsiveFilterPanel
          activeCount={claimFilterCount}
          title="Φίλτρα ζημιών"
          quickFilters={<QuickFilterBar
            activeCount={claimFilterCount}
            onClear={clearClaimFilters}
            options={[
              { key: "all", label: "Όλες", active: claimFilterCount === 0, onClick: clearClaimFilters },
              { key: "open", label: "Ανοιχτές", active: statusFilter === "Reported" || statusFilter === "UnderReview", color: "warning", onClick: () => { setDateWindow(""); setStatusFilter("UnderReview"); } },
              { key: "7", label: "Τελευταίες 7 ημέρες", active: dateWindow === "7", onClick: () => setDateWindow("7") },
              { key: "30", label: "Τελευταίες 30 ημέρες", active: dateWindow === "30", onClick: () => setDateWindow("30") },
              { key: "90", label: "Τελευταίες 90 ημέρες", active: dateWindow === "90", onClick: () => setDateWindow("90") },
              { key: "paid", label: "Πληρωμένες", active: statusFilter === "Paid", color: "success", onClick: () => { setDateWindow(""); setStatusFilter("Paid"); } },
            ]}
          />}
        >
          {/* Dense grid — search+status on line 1, carrier/branch/use/cover
              on line 2, package/dates/clear on line 3 — 3 rows on desktop
              instead of the ~6-row wrap the flex layout produced. */}
          <Box sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
            alignItems: "center",
          }}>
            <SearchableTextField size="small" label={t("claims.col.status")} fullWidth
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "")}>
              <MenuItem value="">{t("audit.filters.allActions")}</MenuItem>
              {(["Reported","UnderReview","Approved","Rejected","Paid","Closed"] as const).map(s =>
                <MenuItem key={s} value={s}>{t(`claims.statuses.${s}`)}</MenuItem>)}
            </SearchableTextField>
            <TextField size="small" label="Πελάτης / Συμβόλαιο / ΑΦΜ" placeholder="Αναζήτηση…" fullWidth
              value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
              sx={{ gridColumn: { md: "span 3" } }}
              InputProps={{
                endAdornment: <FilterHelp title="Αναζήτηση σε ονοματεπώνυμο πελάτη, αριθμό συμβολαίου ή ΑΦΜ." />
              }} />
            <SearchableSelect
              label="Εταιρία"
              value={carrierFilter}
              onChange={(v) => { setCarrierFilter(v); setSubCarrierFilter([]); setTypeFilter(""); setUseFilter(""); setCoverFilter(""); setPackageFilter(""); }}
              emptyLabel="Όλες"
              sx={{ width: "100%" }}
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
              sx={{ width: "100%" }}
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
              sx={{ width: "100%" }}
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
              sx={{ width: "100%" }}
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
              sx={{ width: "100%" }}
              options={filterCatalogue.packages.map(p => ({ value: p.value, label: p.label }))}
            />
            <TextField size="small" type="date" label="Συμβάν από" InputLabelProps={{ shrink: true }} fullWidth
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <TextField size="small" type="date" label="Συμβάν έως" InputLabelProps={{ shrink: true }} fullWidth
              value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Button size="small" fullWidth onClick={clearClaimFilters} color="error" variant="contained">Καθαρισμός</Button>
          </Box>
        </ResponsiveFilterPanel>
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
          hideSearch
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
                  <TableCell
                    onContextMenu={(e) => headerMenu.open(e, { key: "number", label: t("claims.col.number"), type: inferType("number"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.number")}</TableCell>
                  <TableCell
                    onContextMenu={(e) => headerMenu.open(e, { key: "policy", label: t("claims.col.policy"), type: inferType("policy"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.policy")}</TableCell>
                  {!isCustomer && (
                    <TableCell
                      onContextMenu={(e) => headerMenu.open(e, { key: "customer", label: t("claims.col.customer"), type: inferType("customer"), canHide: false })}
                      sx={{ userSelect: "none" }}
                    >{t("claims.col.customer")}</TableCell>
                  )}
                  <TableCell
                    onContextMenu={(e) => headerMenu.open(e, { key: "incidentDate", label: t("claims.col.incidentDate"), type: inferType("incidentDate"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.incidentDate")}</TableCell>
                  <TableCell align="right"
                    onContextMenu={(e) => headerMenu.open(e, { key: "claimed", label: t("claims.col.claimed"), type: inferType("claimed"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.claimed")}</TableCell>
                  <TableCell align="right"
                    onContextMenu={(e) => headerMenu.open(e, { key: "approved", label: t("claims.col.approved"), type: inferType("approved"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.approved")}</TableCell>
                  <TableCell
                    onContextMenu={(e) => headerMenu.open(e, { key: "status", label: t("claims.col.status"), type: inferType("status"), canHide: false })}
                    sx={{ userSelect: "none" }}
                  >{t("claims.col.status")}</TableCell>
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
                    }}
                    onContextMenu={(e) => rowMenu.open(e, c)}>
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
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={table.filtered.length} pageSize={table.pageSize} />
          </Box>
        </Card>
      )}

      {canEdit && (
        <>
          <BulkImportDialog
            open={importOpen}
            title="Μαζική εισαγωγή ζημιών"
            description="Κατεβάστε το ελληνικό πρότυπο XLSX και συμπληρώστε μία ζημιά ανά γραμμή. Χρησιμοποιήστε το ID του υπάρχοντος συμβολαίου. Οι επιτυχίες αποθηκεύονται και οι αποτυχίες επιστρέφουν για διόρθωση."
            columns={CLAIM_IMPORT_COLUMNS}
            onClose={() => setImportOpen(false)}
            onImport={async (rows) => { const result = await importClaims(rows); void qc.invalidateQueries({ queryKey: ["claims"] }); return result; }}
          />
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
      {headerMenu.menu}
      {rowMenu.menu}
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
          <SearchableTextField
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
          </SearchableTextField>
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

          <SearchableTextField
            select label={t("claims.col.status")} value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ClaimStatus })}
            fullWidth
          >
            {(["Reported","UnderReview","Approved","Rejected","Paid","Closed"] as const).map(s =>
              <MenuItem key={s} value={s}>{t(`claims.statuses.${s}`)}</MenuItem>
            )}
          </SearchableTextField>

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
