import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp } from "../components/FilterHelp";
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
  FormControlLabel, Switch, Checkbox, Snackbar, useMediaQuery, useTheme, Divider
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import TuneIcon from "@mui/icons-material/Tune";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import HubIcon from "@mui/icons-material/Hub";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import TableViewOutlinedIcon from "@mui/icons-material/TableViewOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { api, extractErrorMessage } from "../api/client";
import { CredentialsDialog } from "./TenantsPage";
import { ProducerDetailDrawer } from "../components/ProducerDetailDrawer";
import { ProducerCustomersDialog } from "../components/ProducerCustomersDialog";
import { ProducerCreateDialog } from "../components/ProducerCreateDialog";
import { useProducerCategories } from "../components/useProducerCategories";
import { ReassignProducerDialog } from "../components/ReassignProducerDialog";
import PeopleIcon from "@mui/icons-material/People";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useTableState } from "../components/useTableState";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { TableToolbar, NumberedPager, RecordCountChip } from "../components/TableToolbar";
import { SearchableTextField } from "../components/SearchableTextField";
import { money } from "../utils/format";
import { BulkImportDialog, type BulkImportResult } from "../components/BulkImportDialog";
import { SavedReportsButton } from "../components/SavedReportsButton";

type ProducerStatus = "Active" | "Suspended" | "Terminated" | "Prospect";
type ProducerTier = "None" | "A" | "B" | "C" | "D" | "E";

type HierarchyLevel = "Producer" | "Manager" | "Unit" | "Assistant" | "Agency";

const HIERARCHY_LABEL: Record<HierarchyLevel, string> = {
  Producer:  "Συνεργάτης",
  Manager:   "Υπεύθυνος ομάδας",
  Unit:      "Υπεύθυνος μονάδας",
  Assistant: "Βοηθός διοίκησης",
  Agency:    "Γραφείο (κεντρικό)"
};

interface ProducerDto {
  id: string; code: string; name: string;
  email: string | null; phone: string | null;
  notes?: string | null;
  secondaryEmail?: string | null; secondaryPhone?: string | null;
  taxId?: string | null; taxOffice?: string | null;
  businessType?: string | null; professionalCategory?: string | null;
  hasContract?: boolean; contractNumber?: string | null;
  contractStartDate?: string | null; contractEndDate?: string | null;
  address?: string | null; city?: string | null; postalCode?: string | null;
  website?: string | null; identityNumber?: string | null;
  professionalLicenseNumber?: string | null; licenseExpiryDate?: string | null;
  iban?: string | null; bankName?: string | null; paymentMethod?: string | null;
  additionalInfoJson?: string | null;
  status: ProducerStatus; tier: ProducerTier; categoryId?: string | null; categoryName?: string | null;
  policyCount: number; createdAt: string;
  // ALIS-parity hierarchy
  hierarchyLevel: HierarchyLevel;
  parentProducerId: string | null;
  parentProducerName: string | null;
}

const STATUS_COLOR: Record<ProducerStatus, "success" | "warning" | "default"> = {
  Active: "success", Suspended: "warning", Terminated: "default", Prospect: "warning"
};
const TIER_LABEL: Record<ProducerTier, string> = {
  A: "Κατ. Α", B: "Κατ. Β", C: "Κατ. Γ", D: "Κατ. Δ", E: "Κατ. Ε", None: "—"
};

export function producerListRowSx(status: string, index: number) {
  return { cursor: "pointer", bgcolor: status === "Prospect" ? "#fff0d9" : index % 2 === 0 ? "#f8fafc" : "#f0f2f5",
    "&:hover": { bgcolor: status === "Prospect" ? "#ffe3b5" : "#e5edf7" },
    "&.Mui-selected": { bgcolor: "#dcebfa" }, "&.Mui-selected:hover": { bgcolor: "#c9e1f7" } };
}

export function producerListExportColumns(t: (key: string) => string) {
  return [
    { key: "code", label: t("producers.col.code"), map: (row: ProducerDto) => row.code },
    { key: "name", label: t("producers.col.name"), map: (row: ProducerDto) => row.name },
    { key: "tier", label: "Κατηγορία", map: (row: ProducerDto) => row.categoryName ?? "—" },
    { key: "email", label: t("producers.col.email"), map: (row: ProducerDto) => row.email ?? "—" },
    { key: "phone", label: t("producers.col.phone"), map: (row: ProducerDto) => row.phone ?? "—" },
    { key: "policyCount", label: t("producers.col.policies"), map: (row: ProducerDto) => row.policyCount },
    { key: "status", label: t("producers.col.status"), map: (row: ProducerDto) => row.status === "Prospect" ? "Πιθανός συνεργάτης" : t(`producers.statuses.${row.status}`) },
  ];
}

export function filterProducerListRows(rows: ProducerDto[], filters: {
  statusFilter: ProducerStatus | ""; tierFilter: ProducerTier | ""; categoryFilter?: string; hasPoliciesOnly: boolean; hierarchyFilter: HierarchyLevel | "";
}) {
  return rows.filter(row => (!filters.statusFilter || row.status === filters.statusFilter)
    && (!filters.tierFilter || row.tier === filters.tierFilter)
    && (!filters.categoryFilter || (filters.categoryFilter === "None" ? !row.categoryId : row.categoryId === filters.categoryFilter))
    && (!filters.hasPoliciesOnly || row.policyCount !== 0)
    && (!filters.hierarchyFilter || row.hierarchyLevel === filters.hierarchyFilter));
}

const PRODUCER_IMPORT_COLUMNS = [
  { key: "code", label: "Κωδικός συνεργάτη", required: true, example: "P-0001" },
  { key: "name", label: "Ονοματεπώνυμο / Επωνυμία", required: true, example: "Μαρία Παπαδοπούλου" },
  { key: "email", label: "Email", example: "maria@example.gr" },
  { key: "phone", label: "Τηλέφωνο", example: "+30 210 0000000" },
  { key: "notes", label: "Σημειώσεις", example: "Σημείωση συνεργάτη" },
  { key: "status", label: "Κατάσταση (Prospect/Active/Suspended/Terminated)", required: true, example: "Active" },
  { key: "tier", label: "Βαθμίδα (None/A/B/C/D/E)", example: "None" },
  { key: "hierarchyLevel", label: "Επίπεδο ιεραρχίας (Producer/Manager/Unit/Assistant/Agency)", example: "Producer" },
  { key: "parentProducerCode", label: "Κωδικός γονέα", example: "P-0000" },
  { key: "initialPassword", label: "Αρχικός κωδικός πρόσβασης", example: "" },
] as const;

export function ProducersPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const compactFilters = useMediaQuery(theme.breakpoints.down("xl"));
  const qc = useQueryClient();
  const [createStatus, setCreateStatus] = useState<ProducerStatus | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const openProducerCard = (id: string, edit = false) => { setDetailEditing(edit); setDetailId(id); };
  const [customersFor, setCustomersFor] = useState<ProducerDto | null>(null);
  const [reassignFor, setReassignFor] = useState<ProducerDto | null>(null);
  const [credentialFor, setCredentialFor] = useState<ProducerDto | null>(null);
  const [goalPlanFor, setGoalPlanFor] = useState<ProducerDto | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProducerDto | null>(null);
  const [issuedCreds, setIssuedCreds] = useState<{ email: string; password: string } | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [saveFilterRequest, setSaveFilterRequest] = useState(0);
  const [clearSavedFilterRequest, setClearSavedFilterRequest] = useState(0);
  const [toolbarAction, setToolbarAction] = useState<{ token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" }>({ token: 0, action: "csv" });

  const q = useQuery({
    queryKey: ["producers"],
    queryFn: async () => (await api.get<ProducerDto[]>("/producers")).data
  });

  const issuePortal = useMutation({
    mutationFn: async ({ id, password }: { id: string; password?: string }) =>
      (await api.post<{ email: string; temporaryPassword: string }>(`/producers/${id}/portal-account`, { password: password || null })).data,
    onSuccess: (data) => {
      setIssuedCreds({ email: data.email, password: data.temporaryPassword });
      setCredentialFor(null);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/producers/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      setSuccess("Ο συνεργάτης διαγράφηκε επιτυχώς.");
      void qc.invalidateQueries({ queryKey: ["producers"] });
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const [statusFilter, setStatusFilter] = useState<ProducerStatus | "">("");
  const [tierFilter, setTierFilter] = useState<ProducerTier | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const categories = useProducerCategories();
  const [hasPoliciesOnly, setHasPoliciesOnly] = useState(false);
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyLevel | "">("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  useEffect(() => { if (!compactFilters) setAdvancedFiltersOpen(false); }, [compactFilters]);
  const rawProducers = q.data ?? [];
  const allRows = filterProducerListRows(rawProducers, { statusFilter, tierFilter, categoryFilter, hasPoliciesOnly, hierarchyFilter });
  const table = useTableState<ProducerDto>({
    rows: allRows,
    searchableText: (p) => `${p.code} ${p.name} ${p.email ?? ""} ${p.phone ?? ""} ${p.categoryName ?? ""} ${p.status}`,
    pageSize: 25
  });
  const rows = table.paged;
  useEffect(() => { table.setPage(1); }, [statusFilter, tierFilter, categoryFilter, hasPoliciesOnly, hierarchyFilter]);
  const activeFilterCount = [statusFilter, tierFilter, categoryFilter, hasPoliciesOnly ? "policies" : "", hierarchyFilter, table.query].filter(Boolean).length;

  const clearProducerFilters = () => {
    setClearSavedFilterRequest(value => value + 1);
    setStatusFilter("");
    setTierFilter("");
    setCategoryFilter("");
    setHasPoliciesOnly(false);
    setHierarchyFilter("");
    table.setQuery("");
    table.setPage(1);
  };
  const importProducers = async (importRows: Record<string, string>[]): Promise<BulkImportResult> => {
    let imported = 0;
    const errors: string[] = [];
    const failedRows: Record<string, string>[] = [];
    const statuses = new Set<ProducerStatus>(["Prospect", "Active", "Suspended", "Terminated"]);
    const tiers = new Set<ProducerTier>(["None", "A", "B", "C", "D", "E"]);
    const hierarchyLevels = new Set<HierarchyLevel>(["Producer", "Manager", "Unit", "Assistant", "Agency"]);
    for (let index = 0; index < importRows.length; index++) {
      const row = importRows[index];
      try {
        const status = statuses.has(row.status as ProducerStatus) ? row.status as ProducerStatus : "Active";
        const tier = tiers.has(row.tier as ProducerTier) ? row.tier as ProducerTier : "None";
        const hierarchyLevel = hierarchyLevels.has(row.hierarchyLevel as HierarchyLevel)
          ? row.hierarchyLevel as HierarchyLevel
          : "Producer";
        const parentCode = row.parentProducerCode?.trim().toLowerCase();
        const parentProducerId = parentCode
          ? rawProducers.find(p => p.code.trim().toLowerCase() === parentCode)?.id ?? null
          : null;
        await api.post("/producers", {
          code: row.code.trim(),
          name: row.name.trim(),
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          notes: row.notes?.trim() || null,
          status,
          tier,
          hierarchyLevel,
          parentProducerId,
          initialPassword: row.initialPassword?.trim() || null,
        });
        imported++;
      } catch (e) {
        failedRows.push(row);
        errors.push(`Row ${index + 2}: ${extractErrorMessage(e)}`);
      }
    }
    void qc.invalidateQueries({ queryKey: ["producers"] });
    return { imported, failed: importRows.length - imported, errors, failedRows };
  };

  // Right-click on a header → sort by that column. Row menu → edit / delete.
  const inferType = (key: string): ColumnType => key === "policies" ? "number" : "string";
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      const map: Record<string, keyof ProducerDto> = {
        code: "code", name: "name", tier: "categoryName",
        email: "email", phone: "phone", policies: "policyCount", status: "status",
      };
      const dtoKey = map[key];
      if (!dtoKey) return;
      table.toggleSort(dtoKey);
      if (table.sortDir !== dir) table.toggleSort(dtoKey);
    },
  });
  const rowMenu = useRowContextMenu<ProducerDto>({
    entityLabel: "συνεργάτη",
    onEdit: (p) => openProducerCard(p.id, true),
    onDelete: (p) => del.mutate(p.id),
  });

  const renderProducerFilters = (inDialog: boolean) => <Box sx={{ display: "grid", gap: 1, pt: .5, alignItems: "center",
    gridTemplateColumns: inDialog ? { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }
      : "minmax(240px, 1.4fr) minmax(160px, .8fr) minmax(140px, .7fr) minmax(210px, 1fr) auto",
  }}>
    <TextField size="small" fullWidth label="Αναζήτηση συνεργάτη" placeholder="Κωδικός, όνομα, email ή τηλέφωνο…"
      value={table.query} onChange={event => table.setQuery(event.target.value)} sx={{ minWidth: 0, gridColumn: inDialog ? "1 / -1" : undefined }}
      InputProps={{ endAdornment: <FilterHelp title="Αναζήτηση σε κωδικό, όνομα, email ή τηλέφωνο συνεργάτη." /> }} />
    <SearchableTextField size="small" fullWidth label={t("producers.col.status")} value={statusFilter} onChange={event => setStatusFilter(event.target.value as ProducerStatus | "")} sx={{ minWidth: 0 }}>
      <MenuItem value="">Όλες</MenuItem>{(["Prospect", "Active", "Suspended", "Terminated"] as const).map(status => <MenuItem key={status} value={status}>{status === "Prospect" ? "Πιθανός συνεργάτης" : t(`producers.statuses.${status}`)}</MenuItem>)}
    </SearchableTextField>
    <SearchableTextField size="small" fullWidth label="Κατηγορία" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} sx={{ minWidth: 0 }}>
      <MenuItem value="">Όλες</MenuItem>
      {(categories.data ?? []).map(category => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
      <MenuItem value="None">Χωρίς κατηγορία</MenuItem>
    </SearchableTextField>
    <SearchableTextField size="small" fullWidth label="Επίπεδο ιεραρχίας" value={hierarchyFilter} onChange={event => setHierarchyFilter(event.target.value as HierarchyLevel | "")} sx={{ minWidth: 0 }}>
      <MenuItem value="">Όλα</MenuItem>{(Object.keys(HIERARCHY_LABEL) as HierarchyLevel[]).map(level => <MenuItem key={level} value={level}>{HIERARCHY_LABEL[level]}</MenuItem>)}
    </SearchableTextField>
    <FormControlLabel sx={{ m: 0, minWidth: 0, gridColumn: inDialog ? "1 / -1" : undefined }} control={<Checkbox size="small" checked={hasPoliciesOnly} onChange={event => setHasPoliciesOnly(event.target.checked)} />} label="Μόνο με συμβόλαια" />
  </Box>;
  const producerExportColumns = producerListExportColumns(t);
  const producerExportSubtitle = [categoryFilter && `Κατηγορία: ${categoryFilter === "None" ? "Χωρίς κατηγορία" : categories.data?.find(row => row.id === categoryFilter)?.name ?? categoryFilter}`, table.query && `Αναζήτηση: ${table.query}`,
    statusFilter && `Κατάσταση: ${statusFilter === "Prospect" ? "Πιθανός συνεργάτης" : t(`producers.statuses.${statusFilter}`)}`,
    tierFilter && `Βαθμίδα προμηθειών: ${tierFilter === "None" ? "Χωρίς κατηγορία" : TIER_LABEL[tierFilter]}`,
    hierarchyFilter && `Ιεραρχία: ${HIERARCHY_LABEL[hierarchyFilter]}`, hasPoliciesOnly && "Μόνο με συμβόλαια",
  ].filter(Boolean).join(" · ");

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{t("producers.title")}</Typography>
            <HelpHint id="page.producers" />
            <RecordCountChip count={table.filtered.length} />
          </Stack>
          <Typography color="text.secondary">{t("producers.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <SavedReportsButton entity="producers" currentFilters={{ query: table.query, statusFilter, tierFilter, categoryFilter, hasPoliciesOnly, hierarchyFilter }}
            onLoad={next => { table.setQuery(next.query ?? ""); setStatusFilter(next.statusFilter ?? ""); setTierFilter(next.tierFilter ?? ""); setCategoryFilter(next.categoryFilter ?? ""); setHasPoliciesOnly(Boolean(next.hasPoliciesOnly)); setHierarchyFilter(next.hierarchyFilter ?? ""); }}
            onClear={clearProducerFilters} clearRequestToken={clearSavedFilterRequest} saveRequestToken={saveFilterRequest} showSaveMenuItem={false} />
          {compactFilters && <Button variant="contained" startIcon={<FilterListIcon />} onClick={() => setAdvancedFiltersOpen(true)} aria-haspopup="dialog" aria-expanded={advancedFiltersOpen}
            sx={{ bgcolor: "#159b59", color: "#fff", whiteSpace: "nowrap", flexShrink: 0, "&:hover": { bgcolor: "#107b46", color: "#fff" } }}>
            Φίλτρα{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>}
          <Button
            component={RouterLink}
            to="/app/partner-networks"
            variant="outlined"
            size="large"
            startIcon={<HubIcon />}
            sx={{
              color: "#0b6f9c",
              borderColor: "#72c7d6",
              bgcolor: "#eaf8fb",
              "&:hover": { bgcolor: "#d6f0f5", borderColor: "#0b6f9c" },
            }}
          >
            {t("nav.partnerNetworks", "Δίκτυα συνεργατών")}
          </Button>
          <Button data-tour="producers-actions" variant="contained" size="large" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />}
            onClick={event => setActionsAnchor(event.currentTarget)} aria-haspopup="menu" aria-expanded={Boolean(actionsAnchor)}>Ενέργειες</Button>
          <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { minWidth: 290, maxWidth: "calc(100vw - 24px)" } } }}>
            <MenuItem data-tour="producers-new" onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Active"); }} sx={{ color: "#0877c9", "&:hover": { bgcolor: "#e7f2fd" } }}>
              <ListItemIcon sx={{ color: "#0877c9" }}><AddIcon fontSize="small" /></ListItemIcon><ListItemText primary={t("producers.create")} />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); setError(null); setCreateStatus("Prospect"); }} sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df" } }}>
              <ListItemIcon sx={{ color: "#a45b00" }}><PersonAddAltOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText primary="Πιθανός συνεργάτης" />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); setImportOpen(true); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}>
              <ListItemIcon sx={{ color: "#167c45" }}><TableViewOutlinedIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εισαγωγή Excel" />
            </MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); setSaveFilterRequest(value => value + 1); }} sx={{ color: "#0b5cad", "&:hover": { bgcolor: "#e7f1fc" } }}>
              <ListItemIcon sx={{ color: "#0b5cad" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText primary="Αποθήκευση νέου φίλτρου" />
            </MenuItem>
            <Divider />
            <MenuItem disabled={q.isLoading || q.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "csv" })); }} sx={{ color: "#087f73", "&:hover": { bgcolor: "#e5f6f3" } }}><ListItemIcon sx={{ color: "#087f73" }}><TableChartIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή CSV" /></MenuItem>
            <MenuItem disabled={q.isLoading || q.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "xlsx" })); }} sx={{ color: "#167c45", "&:hover": { bgcolor: "#e7f5ec" } }}><ListItemIcon sx={{ color: "#167c45" }}><GridOnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή Excel" /></MenuItem>
            <MenuItem disabled={q.isLoading || q.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "pdf" })); }} sx={{ color: "#c73545", "&:hover": { bgcolor: "#fdecef" } }}><ListItemIcon sx={{ color: "#c73545" }}><PictureAsPdfIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εξαγωγή PDF" /></MenuItem>
            <MenuItem disabled={q.isLoading || q.isError} onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "print" })); }} sx={{ color: "#456b91", "&:hover": { bgcolor: "#edf2f7" } }}><ListItemIcon sx={{ color: "#456b91" }}><PrintIcon fontSize="small" /></ListItemIcon><ListItemText primary="Εκτύπωση" /></MenuItem>
            <Divider />
            <MenuItem onClick={() => { setActionsAnchor(null); setToolbarAction(value => ({ token: value.token + 1, action: "columns" })); }} sx={{ color: "#5b55a5", "&:hover": { bgcolor: "#efedfb" } }}><ListItemIcon sx={{ color: "#5b55a5" }}><ViewColumnIcon fontSize="small" /></ListItemIcon><ListItemText primary="Στήλες εξαγωγής" /></MenuItem>
            <MenuItem onClick={() => { setActionsAnchor(null); setAdvancedFiltersOpen(true); }} sx={{ color: "#a45b00", "&:hover": { bgcolor: "#fff3df" } }}><ListItemIcon sx={{ color: "#a45b00" }}><TuneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Σύνθετα φίλτρα" /></MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {!compactFilters && <Card variant="outlined" sx={{ p: 1, mb: 1, bgcolor: "#edf2f7", borderColor: "#d5e0ec" }}>{renderProducerFilters(false)}</Card>}
      <Dialog open={advancedFiltersOpen} onClose={() => setAdvancedFiltersOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Φίλτρα συνεργατών</DialogTitle>
        <DialogContent dividers>{renderProducerFilters(true)}</DialogContent>
        <DialogActions><Button color="error" variant="contained" onClick={clearProducerFilters}>Καθαρισμός φίλτρων</Button><Button variant="contained" onClick={() => setAdvancedFiltersOpen(false)}>Εφαρμογή</Button></DialogActions>
      </Dialog>

      <Box sx={{ mb: 0 }}>
        <TableToolbar<ProducerDto>
          query={table.query} onQuery={table.setQuery}
          count={allRows.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`producers-${new Date().toISOString().slice(0, 10)}`}
          snapshotExport
          printOfficeSource="export"
          printTitle="Συνεργάτες" printSubtitle={producerExportSubtitle} columnSelectionId="producers"
          visibleColumnKeys={producerExportColumns.map(column => column.key)}
          hideSearch
          actionRequest={toolbarAction}
          hideActionButtons
          hideCount
          hidePageSize
          exportColumns={producerExportColumns}
        />
      </Box>
      {q.isError && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={() => void q.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(q.error)}</Alert>}
      {q.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box> : (
        <Card variant="outlined" sx={{ bgcolor: "#f8fafc", borderColor: "#d5e0ec", overflow: "hidden", boxShadow: "none" }}>
          <TableContainer sx={{ maxHeight: "70vh", overflow: "auto" }}>
            <Table size="small" stickyHeader aria-label="Μητρώο συνεργατών" sx={{ minWidth: 1100,
              "& th": { bgcolor: "#e9eef4", color: "#102d55", fontWeight: 800 },
              "& td, & th": { borderColor: "#dfe5ed", px: 1, py: .75, fontSize: 13 },
            }}>
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
                  <TableRow key={p.id} hover sx={producerListRowSx(p.status, idx)}
                    data-tour={idx === 0 ? "producers-row" : undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a, .MuiIconButton-root")) return;
                      openProducerCard(p.id);
                    }}
                    onContextMenu={(e) => rowMenu.open(e, p)}>
                    <TableCell><Chip label={p.code} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography fontWeight={600}>{p.name}</Typography>
                        {p.status === "Prospect" && <Chip size="small" color="warning" label="Πιθανός συνεργάτης" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {p.categoryName
                        ? <Chip size="small" color="primary" label={p.categoryName} sx={{ fontWeight: 800 }} />
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>{p.email ?? "—"}</TableCell>
                    <TableCell>{p.phone ?? "—"}</TableCell>
                    <TableCell align="right">{p.policyCount}</TableCell>
                    <TableCell><Chip size="small" color={STATUS_COLOR[p.status]} label={p.status === "Prospect" ? "Πιθανός συνεργάτης" : t(`producers.statuses.${p.status}`)} /></TableCell>
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
                        <IconButton size="small" title="Ορισμός / επαναφορά κωδικού πρόσβασης"
                          disabled={!p.email || p.status !== "Active" || issuePortal.isPending}
                          onClick={() => setCredentialFor(p)}>
                          <VpnKeyIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="primary" title="Στόχοι και κλιμάκωση προμήθειας"
                          onClick={(e) => { e.stopPropagation(); setGoalPlanFor(p); }}>
                          <SettingsSuggestIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openProducerCard(p.id, true)} title="Επεξεργασία συνεργάτη"><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8}>
                    <Typography textAlign="center" color="text.secondary" py={4}>{t("producers.empty")}</Typography>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", px: 2, py: 1, bgcolor: "#edf2f7", borderTop: "1px solid #d5e0ec" }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={table.filtered.length} pageSize={table.pageSize} onPageSize={table.setPageSize} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Επιβεβαίωση διαγραφής συνεργάτη</DialogTitle>
        <DialogContent>
          Θέλετε να διαγράψετε τον συνεργάτη «{deleteTarget?.name ?? ""}»; Η διαγραφή επιτρέπεται μόνο αν δεν έχει συμβόλαια, προμήθειες, χρήστες ή άλλο συνδεδεμένο ιστορικό.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Ακύρωση</Button>
          <Button color="error" variant="contained" disabled={del.isPending} onClick={() => deleteTarget && del.mutate(deleteTarget.id)}>
            {del.isPending ? <CircularProgress size={18} color="inherit" /> : "Είμαι σίγουρος"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={success !== null} autoHideDuration={3500} onClose={() => setSuccess(null)}>
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)}>{success}</Alert>
      </Snackbar>

      <ProducerCreateDialog
        open={createStatus !== null} initialStatus={createStatus ?? "Active"} onClose={() => setCreateStatus(null)}
        onSaved={(result) => {
          void qc.invalidateQueries({ queryKey: ["producers"] });
          void qc.invalidateQueries({ queryKey: ["producers-for-hierarchy"] });
          setCreateStatus(null);
          openProducerCard(result.producer.id, true);
          if (result.portalEmail && result.temporaryPassword) setIssuedCreds({ email: result.portalEmail, password: result.temporaryPassword });
        }}
      />

      <ProducerPasswordDialog
        producer={credentialFor}
        saving={issuePortal.isPending}
        onClose={() => setCredentialFor(null)}
        onSubmit={(password) => credentialFor && issuePortal.mutate({ id: credentialFor.id, password })}
      />

      <ProducerGoalPlanDialog
        producer={goalPlanFor}
        onClose={() => setGoalPlanFor(null)}
      />



      <ProducerDetailDrawer
        key={`${detailId ?? "closed"}:${detailEditing ? "edit" : "view"}`}
        producerId={detailId}
        initialEditing={detailEditing}
        canEdit
        open={!!detailId}
        onClose={() => setDetailId(null)}
      />

      <CredentialsDialog
        open={!!issuedCreds}
        email={issuedCreds?.email ?? ""}
        password={issuedCreds?.password ?? ""}
        onClose={() => setIssuedCreds(null)}
        title="Στοιχεία πρόσβασης συνεργάτη"
        introKey="producers.portalCreatedBody"
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

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Μαζική εισαγωγή συνεργατών"
        description="Κατεβάστε το πρότυπο XLSX, συμπληρώστε συνεργάτες ή πιθανούς συνεργάτες και ανεβάστε το αρχείο. Οι γραμμές ελέγχονται ξεχωριστά και οι αποτυχίες εμφανίζονται χωρίς να ακυρώνουν τις επιτυχημένες εισαγωγές."
        columns={[...PRODUCER_IMPORT_COLUMNS]}
        onImport={importProducers}
      />
    </Box>
  );
}

function ProducerPasswordDialog({
  producer,
  saving,
  onClose,
  onSubmit
}: {
  producer: ProducerDto | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (password?: string) => void;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (producer) setPassword("");
  }, [producer]);

  return (
    <Dialog open={!!producer} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Ορισμός κωδικού συνεργάτη</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {producer?.name} · {producer?.email}
        </Typography>
        <TextField
          autoFocus
          label="Νέος κωδικός"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          helperText="Αφήστε το κενό για ασφαλή αυτόματο κωδικό. Ο κωδικός εμφανίζεται μία φορά, για να τον αντιγράψετε και να τον στείλετε εσείς."
          inputProps={{ minLength: 8, maxLength: 128 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Ακύρωση</Button>
        <Button
          variant="contained"
          onClick={() => onSubmit(password.trim() || undefined)}
          disabled={saving || (password.length > 0 && password.length < 8)}
        >
          {saving ? <CircularProgress size={18} /> : "Αποθήκευση κωδικού"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ProducerGoalPlanDto {
  enabled: boolean;
  targetMode: "Premium" | "Policies" | "Vehicles";
  baseCommissionPercent: number | null;
  firstTargetPremium: number | null;
  premiumStep: number | null;
  firstTargetCount: number | null;
  countStep: number | null;
  commissionIncreasePercent: number;
  maximumCommissionPercent: number;
  levelCount: number;
  currentCommissionPercent: number;
  currentCommissionAmount: number;
  currentPremium: number;
  currentPolicyCount: number;
  currentVehicleCount: number;
}

/**
 * Per-producer office setup. This lives next to the collaborator's profile
 * actions so the office never has to impersonate the producer to alter a
 * target curve. Empty premium/base values intentionally mean "automatic".
 */
function ProducerGoalPlanDialog({ producer, onClose }: {
  producer: ProducerDto | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: true,
    targetMode: "Premium" as "Premium" | "Policies" | "Vehicles",
    baseCommissionPercent: "",
    firstTargetPremium: "",
    premiumStep: "",
    firstTargetCount: "",
    countStep: "",
    commissionIncreasePercent: "1",
    maximumCommissionPercent: "14",
    levelCount: "4",
  });
  const plan = useQuery({
    queryKey: ["producer-goal-plan", producer?.id],
    enabled: !!producer,
    queryFn: async () => (await api.get<ProducerGoalPlanDto>(`/producers/${producer!.id}/goal-plan`)).data,
  });

  useEffect(() => {
    if (!producer) return;
    const current = plan.data;
    if (!current) return;
    setForm({
      enabled: current.enabled,
      targetMode: current.targetMode,
      baseCommissionPercent: current.baseCommissionPercent?.toString() ?? "",
      firstTargetPremium: current.firstTargetPremium?.toString() ?? "",
      premiumStep: current.premiumStep?.toString() ?? "",
      firstTargetCount: current.firstTargetCount?.toString() ?? "",
      countStep: current.countStep?.toString() ?? "",
      commissionIncreasePercent: current.commissionIncreasePercent.toString(),
      maximumCommissionPercent: current.maximumCommissionPercent.toString(),
      levelCount: current.levelCount.toString(),
    });
    setError(null);
  }, [producer, plan.data]);

  const save = useMutation({
    mutationFn: async () => {
      const optionalNumber = (value: string) => value.trim() === "" ? null : Number(value);
      return api.put<ProducerGoalPlanDto>(`/producers/${producer!.id}/goal-plan`, {
        enabled: form.enabled,
        targetMode: form.targetMode,
        baseCommissionPercent: optionalNumber(form.baseCommissionPercent),
        firstTargetPremium: optionalNumber(form.firstTargetPremium),
        premiumStep: optionalNumber(form.premiumStep),
        firstTargetCount: form.targetMode === "Premium" ? null : (form.firstTargetCount.trim() === "" ? null : Number(form.firstTargetCount)),
        countStep: form.targetMode === "Premium" ? null : (form.countStep.trim() === "" ? null : Number(form.countStep)),
        commissionIncreasePercent: Number(form.commissionIncreasePercent),
        maximumCommissionPercent: Number(form.maximumCommissionPercent),
        levelCount: Number(form.levelCount),
      });
    },
    onSuccess: onClose,
    onError: err => setError(extractErrorMessage(err, "Δεν ήταν δυνατή η αποθήκευση του πλάνου στόχων.")),
  });

  const isValid =
    Number(form.commissionIncreasePercent) >= 0 &&
    Number(form.maximumCommissionPercent) >= 0 && Number(form.maximumCommissionPercent) <= 100 &&
    Number(form.levelCount) >= 1 && Number(form.levelCount) <= 12 &&
    (form.targetMode === "Premium" ||
      ((form.firstTargetCount.trim() === "" || Number(form.firstTargetCount) >= 0) &&
       (form.countStep.trim() === "" || Number(form.countStep) >= 1)));

  return (
    <Dialog open={!!producer} onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Στόχοι & κλιμάκωση προμήθειας</DialogTitle>
      <DialogContent>
        {plan.isLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress /></Box> : (
          <Stack spacing={2.25} mt={1}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            <Typography color="text.secondary">
              {producer?.name}. Οι ρυθμίσεις είναι προσωπικές για αυτόν τον συνεργάτη και εμφανίζονται μόνο στο δικό του portal.
            </Typography>
            {plan.data && (
              <Alert severity="success">
                <strong>Τρέχουσα πραγματική εικόνα:</strong> {plan.data.currentCommissionPercent.toFixed(2)}% μέσο ποσοστό στα {plan.data.currentPolicyCount} ενεργά συμβόλαια · {money(plan.data.currentCommissionAmount)} μικτή προμήθεια πάνω σε {money(plan.data.currentPremium)} παραγωγή.
              </Alert>
            )}
            <Alert severity="info">
              <strong>Πώς λειτουργεί:</strong> ορίζετε checkpoints παραγωγής και την αύξηση που θα εμφανίζεται ως επόμενο επίπεδο. Το πλάνο παρουσιάζει στόχους και εκτίμηση προμήθειας· δεν αλλάζει αυτόματα κανόνες προμηθειών ή ήδη εκκαθαρισμένα ποσά.
            </Alert>
            <FormControlLabel
              control={<Switch checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} />}
              label="Ενεργό πλάνο στόχων για τον συνεργάτη"
            />
            <TextField
              select fullWidth label="Μονάδα στόχου"
              value={form.targetMode}
              onChange={event => setForm({ ...form, targetMode: event.target.value as "Premium" | "Policies" | "Vehicles" })}
              helperText={form.targetMode === "Premium"
                ? "Οι βαθμίδες βασίζονται σε συνολικά ασφάλιστρα (€)."
                : form.targetMode === "Vehicles"
                  ? "Μετράει διαφορετικές πινακίδες οχημάτων στα ενεργά συμβόλαια."
                  : "Μετράει συμβόλαια που ξεκινούν μέσα στον μήνα."}
            >
              <MenuItem value="Premium">Ασφάλιστρα (€)</MenuItem>
              <MenuItem value="Policies">Πλήθος συμβολαίων</MenuItem>
              <MenuItem value="Vehicles">Πλήθος οχημάτων</MenuItem>
            </TextField>
            {form.targetMode !== "Premium" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  type="number" fullWidth label="Πρώτος στόχος πλήθους"
                  value={form.firstTargetCount}
                  onChange={event => setForm({ ...form, firstTargetCount: event.target.value })}
                  inputProps={{ min: 0, step: 1 }}
                  helperText={form.targetMode === "Vehicles" ? "Πλήθος διαφορετικών οχημάτων." : "Πλήθος συμβολαίων."}
                />
                <TextField
                  type="number" fullWidth label="Βήμα πλήθους ανά βαθμίδα"
                  value={form.countStep}
                  onChange={event => setForm({ ...form, countStep: event.target.value })}
                  inputProps={{ min: 1, step: 1 }}
                  helperText="Πόσα επιπλέον συμβόλαια ή οχήματα χρειάζονται σε κάθε checkpoint."
                />
              </Stack>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number" fullWidth label="Βασικό ποσοστό στόχων (%)"
                value={form.baseCommissionPercent}
                onChange={event => setForm({ ...form, baseCommissionPercent: event.target.value })}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText={`Αφετηρία υπολογισμού. Κενό = το τρέχον ${plan.data?.currentCommissionPercent.toFixed(2) ?? "πραγματικό"}% του συνεργάτη.`}
              />
              <TextField
                type="number" fullWidth required label="Αύξηση ανά βαθμίδα (%)"
                value={form.commissionIncreasePercent}
                onChange={event => setForm({ ...form, commissionIncreasePercent: event.target.value })}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="Η αύξηση σε κάθε checkpoint. Π.χ. 1 = +1 μονάδα στο επόμενο επίπεδο."
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number" fullWidth label="1ος στόχος παραγωγής (€)"
                value={form.firstTargetPremium}
                onChange={event => setForm({ ...form, firstTargetPremium: event.target.value })}
                inputProps={{ min: 0, step: 100 }}
                helperText="Το πρώτο checkpoint. Κενό = αυτόματα 25% πάνω από την τρέχουσα παραγωγή."
              />
              <TextField
                type="number" fullWidth label="Βήμα παραγωγής ανά βαθμίδα (€)"
                value={form.premiumStep}
                onChange={event => setForm({ ...form, premiumStep: event.target.value })}
                inputProps={{ min: 0, step: 100 }}
                helperText="Η απόσταση μεταξύ checkpoints. Κενό = αυτόματα προτεινόμενο βήμα."
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="number" fullWidth required label="Μέγιστο ποσοστό (%)"
                value={form.maximumCommissionPercent}
                onChange={event => setForm({ ...form, maximumCommissionPercent: event.target.value })}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                helperText="Το ανώτατο επιτρεπτό επίπεδο για αυτόν τον συνεργάτη. Π.χ. 14, 18 ή 20."
              />
              <TextField
                type="number" fullWidth required label="Πλήθος βαθμίδων"
                value={form.levelCount}
                onChange={event => setForm({ ...form, levelCount: event.target.value })}
                inputProps={{ min: 1, max: 12, step: 1 }}
                helperText="Πόσα checkpoints θα εμφανίζονται στο portal (1–12)."
              />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>Ακύρωση</Button>
        <Button variant="contained" onClick={() => save.mutate()} disabled={plan.isLoading || save.isPending || !isValid}>
          {save.isPending ? <CircularProgress size={18} /> : "Αποθήκευση πλάνου"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
