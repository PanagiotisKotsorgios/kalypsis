import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Card, Chip, CircularProgress, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, TextField, Tooltip, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FilterListIcon from "@mui/icons-material/FilterList";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import TableChartIcon from "@mui/icons-material/TableChart";
import GridOnIcon from "@mui/icons-material/GridOn";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { api, extractErrorMessage } from "../api/client";
import { SavedReportsButton } from "../components/SavedReportsButton";
import { ResponsiveFilterPanel } from "../components/ResponsiveFilterPanel";
import { FilterVisibilityPicker, useFilterVisibility, type FilterVisibilityDescriptor } from "../components/FilterVisibilityPicker";
import { SearchableMultiSelect } from "../components/SearchableMultiSelect";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { TableToolbar, NumberedPager, RecordCountChip } from "../components/TableToolbar";
import { useTableState } from "../components/useTableState";
import { NEED_KINDS, NEED_LABEL, RELATION_LABEL } from "../components/customer/customerFamilyData";
import { CustomerDetailPage } from "./CustomerDetailPage";
import { defaultGrowthFilters, normalizeGrowthFilters, filterGrowthRows, growthGroupLabel, GROWTH_STATES, GROWTH_CUSTOMER_STATUSES, GROWTH_POLICY_TYPES, type ProductionGrowthFilters, type ProductionGrowthRow } from "./productionGrowth";

const FILTERS: FilterVisibilityDescriptor[] = [
  { key: "search", label: "Αναζήτηση" }, { key: "view", label: "Προβολή" }, { key: "kinds", label: "Ανάγκη / προτεινόμενη κάλυψη" },
  { key: "coverageStates", label: "Κατάσταση κάλυψης" }, { key: "assetKinds", label: "Διαθέτει περιουσία / ανάγκη" },
  { key: "activePolicyTypes", label: "Έχει ενεργά συμβόλαια", defaultOff: true }, { key: "producerIds", label: "Συνεργάτης" }, { key: "cities", label: "Πόλη" },
  { key: "customerStatuses", label: "Κατάσταση πελάτη", defaultOff: true }, { key: "family", label: "Οικογένεια", defaultOff: true }, { key: "priorityMin", label: "Προτεραιότητα" },
  { key: "contactState", label: "Χρόνος επικοινωνίας", defaultOff: true }, { key: "contactFrom", label: "Επικοινωνία από", defaultOff: true }, { key: "contactTo", label: "Επικοινωνία έως", defaultOff: true },
  { key: "groupBy", label: "Ομαδοποίηση" },
];
const COLUMNS = [
  { key: "customer", label: "Πελάτης", alwaysVisible: true }, { key: "assets", label: "Διαθέτει" },
  { key: "need", label: "Ανάγκη / πρόταση", alwaysVisible: true }, { key: "state", label: "Κατάσταση κάλυψης" },
  { key: "policies", label: "Ενεργές καλύψεις" }, { key: "priority", label: "Προτερ." },
  { key: "next", label: "Επόμ. επικοινωνία" }, { key: "contact", label: "Επικοινωνία" },
  { key: "producer", label: "Συνεργάτης", defaultVisible: false }, { key: "city", label: "Πόλη", defaultVisible: false },
  { key: "family", label: "Οικογένεια", defaultVisible: false }, { key: "notes", label: "Σημειώσεις", defaultVisible: false },
  { key: "reason", label: "Αιτιολογία", defaultVisible: false },
];
const kinds = NEED_KINDS.map(value => ({ value, label: NEED_LABEL[value] ?? value }));
const policyKinds = Object.entries(GROWTH_POLICY_TYPES).map(([value, label]) => ({ value, label }));
const shortDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("el-GR") : "—";
const joinKinds = (values: string[], labels: Record<string, string>) => values.map(value => labels[value] ?? value).join(", ") || "—";
const SORT_FIELDS: Record<string, keyof ProductionGrowthRow> = { customer: "customerName", need: "needTitle", priority: "priority", next: "nextContactAt", city: "city", state: "coverageState", notes: "notes", reason: "reason" };

export function ProductionGrowthPage() {
  const [filters, setFilters] = useState(defaultGrowthFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [saveRequest, setSaveRequest] = useState(0);
  const [clearRequest, setClearRequest] = useState(0);
  const [action, setAction] = useState<{ token: number; action: "csv" | "xlsx" | "pdf" | "print" | "columns" }>({ token: 0, action: "csv" });
  const [customer, setCustomer] = useState<ProductionGrowthRow | null>(null);
  const visibility = useFilterVisibility("production-growth", FILTERS);
  const columns = useColumnPreferences("production-growth", COLUMNS);
  const query = useQuery({ queryKey: ["production-growth"], queryFn: async () => (await api.get<ProductionGrowthRow[]>("/production-growth")).data, refetchOnWindowFocus: true });
  const allRows = query.data ?? [];
  const rows = useMemo(() => filterGrowthRows(query.data ?? [], filters), [query.data, filters]);
  const table = useTableState({ rows, searchableText: () => "", pageSize: 25, initialSortKey: "priority", initialSortDir: "desc" });
  const displayRows = useMemo(() => filters.groupBy ? [...table.filtered].sort((a, b) => growthGroupLabel(a, filters.groupBy).localeCompare(growthGroupLabel(b, filters.groupBy), "el")) : table.filtered, [table.filtered, filters.groupBy]);
  const pageRows = displayRows.slice((table.page - 1) * table.pageSize, table.page * table.pageSize);
  const groupCounts = new Map<string, number>();
  displayRows.forEach(row => { const key = growthGroupLabel(row, filters.groupBy); groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1); });
  const update = <K extends keyof ProductionGrowthFilters>(key: K, value: ProductionGrowthFilters[K]) => {
    setFilters(previous => {
      const next = { ...previous, [key]: value };
      if (key === "view" && value === "opportunities") next.coverageStates = [];
      if (key === "coverageStates" && Array.isArray(value) && value.some(state => state !== "Uncovered")) next.view = "all";
      return next;
    });
    table.setPage(1);
  };
  const reset = () => { setFilters(defaultGrowthFilters()); setClearRequest(value => value + 1); table.setPage(1); };
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== "view" && key !== "groupBy" && (Array.isArray(value) ? value.length : Boolean(value))).length;
  const options = (key: "city" | "producers") => key === "city"
    ? [...new Set(allRows.map(row => row.city).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, "el")).map(value => ({ value, label: value }))
    : [...new Map(allRows.flatMap(row => row.producers).map(p => [p.id, p])).values()].sort((a, b) => a.name.localeCompare(b.name, "el")).map(p => ({ value: p.id, label: p.name }));
  const multi = (key: "kinds" | "coverageStates" | "assetKinds" | "activePolicyTypes" | "producerIds" | "cities" | "customerStatuses", label: string, values: { value: string; label: string }[]) => visibility.visible(key)
    ? <SearchableMultiSelect label={label} values={filters[key]} options={values} onChange={next => update(key, next)} showSelectAll /> : null;
  const run = (next: typeof action.action) => { setMenu(null); setAction(previous => ({ token: previous.token + 1, action: next })); };
  const renderCell = (key: string, row: ProductionGrowthRow) => {
    switch (key) {
      case "customer": return <Button size="small" onClick={() => setCustomer(row)} sx={{ p: 0, textAlign: "left", display: "block", minWidth: 150 }}><Typography fontSize={12.5} fontWeight={800}>{row.customerName}</Typography><Typography fontSize={11} color="text.secondary">{row.customerNumber} · {GROWTH_CUSTOMER_STATUSES[row.customerStatus] ?? row.customerStatus}</Typography></Button>;
      case "assets": return joinKinds(row.assetKinds, NEED_LABEL);
      case "need": return <Box sx={{ minWidth: 170, maxWidth: 250 }}><Typography fontSize={12.5} fontWeight={750}>{row.needKind ? NEED_LABEL[row.needKind] ?? row.needKind : "Χωρίς στοιχεία"}</Typography><Tooltip title={row.needTitle} enterTouchDelay={0}><Typography fontSize={12} noWrap>{row.needTitle}</Typography></Tooltip></Box>;
      case "state": return <Tooltip title={row.reason} enterTouchDelay={0}><Chip size="small" label={GROWTH_STATES[row.coverageState] ?? row.coverageState} color={row.isOpportunity ? "warning" : row.coverageState === "DeclaredInsured" ? "success" : row.coverageState === "ActivePolicy" ? "info" : "default"} sx={{ height: 23, fontSize: 11 }} /></Tooltip>;
      case "policies": return joinKinds(row.activePolicyTypes, GROWTH_POLICY_TYPES);
      case "priority": return row.needId ? <Chip size="small" label={`${row.priority}/5`} color={row.priority >= 4 ? "error" : "default"} sx={{ height: 22 }} /> : "—";
      case "next": return shortDate(row.nextContactAt);
      case "contact": return <Stack spacing={.15} sx={{ minWidth: 140 }}>{row.phone && <Typography component="a" href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} fontSize={12}>{row.phone}</Typography>}{row.email && <Typography component="a" href={`mailto:${row.email}`} fontSize={12} sx={{ overflowWrap: "anywhere" }}>{row.email}</Typography>}{!row.email && !row.phone && "—"}</Stack>;
      case "producer": return row.producers.map(p => p.name).join(", ") || "—";
      case "city": return row.city || "—";
      case "family": return row.family.map(p => `${p.name} (${RELATION_LABEL[p.relationship] ?? p.relationship})`).join(", ") || "—";
      case "notes": return row.notes || "—";
      case "reason": return row.reason;
      default: return "—";
    }
  };
  return <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} mb={1}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={.75}><TrendingUpIcon color="primary" /><Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.2rem", sm: "1.5rem" } }}>Λίστες αύξησης παραγωγής</Typography><RecordCountChip count={displayRows.length} /><Chip size="small" label={`${new Set(displayRows.map(row => row.customerId)).size} πελάτες`} /></Stack>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={.75}>
        <SavedReportsButton entity="production-growth" currentFilters={filters} onLoad={value => { setFilters(normalizeGrowthFilters(value)); table.setPage(1); }} onClear={reset} clearRequestToken={clearRequest} saveRequestToken={saveRequest} showSaveMenuItem={false} />
        <Button variant="contained" startIcon={<MoreHorizIcon />} endIcon={<KeyboardArrowDownIcon />} onClick={event => setMenu(event.currentTarget)} aria-haspopup="menu" aria-expanded={!!menu}>Ενέργειες</Button>
        <Button variant="contained" startIcon={<FilterListIcon />} onClick={() => setFilterOpen(true)} sx={{ display: { xs: "inline-flex", xl: "none" }, bgcolor: "#159b59", color: "#fff", "&:hover": { bgcolor: "#107b46" } }}>Φίλτρα{activeCount ? ` (${activeCount})` : ""}</Button>
      </Stack>
    </Stack>
    <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
      <MenuItem onClick={() => { setMenu(null); setSaveRequest(value => value + 1); }} sx={{ color: "#5b55a5" }}><ListItemIcon sx={{ color: "inherit" }}><BookmarkAddIcon fontSize="small" /></ListItemIcon><ListItemText>Αποθήκευση νέου φίλτρου</ListItemText></MenuItem>
      <Divider />
      {([['csv', 'Εξαγωγή CSV', TableChartIcon, '#087f73'], ['xlsx', 'Εξαγωγή Excel', GridOnIcon, '#167c45'], ['pdf', 'Εξαγωγή PDF', PictureAsPdfIcon, '#c73545'], ['print', 'Εκτύπωση', PrintIcon, '#456b91'], ['columns', 'Στήλες εξαγωγής', ViewColumnIcon, '#5b55a5']] as const).map(([key, label, Icon, color]) => <MenuItem key={key} onClick={() => run(key)} sx={{ color }}><ListItemIcon sx={{ color: "inherit" }}><Icon fontSize="small" /></ListItemIcon>{label}</MenuItem>)}
      <Divider /><MenuItem onClick={() => { setMenu(null); void query.refetch(); }}><ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>Ανανέωση δεδομένων</MenuItem>
    </Menu>
    <ResponsiveFilterPanel title="Φίλτρα αύξησης παραγωγής" activeCount={activeCount} compactAt="xl" compactButtonPlacement="external" compactOpen={filterOpen} onCompactOpenChange={setFilterOpen} cardSx={{ bgcolor: "#edf2f7", border: "1px solid #d5e0ec", boxShadow: "none", mb: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, alignItems: "center", gap: 1, pt: .5 }}>
        {visibility.visible("search") && <TextField size="small" label="Αναζήτηση πελάτη / ανάγκης" value={filters.search} onChange={e => update("search", e.target.value)} />}
        {visibility.visible("view") && <TextField select size="small" label="Προβολή" value={filters.view} onChange={e => update("view", e.target.value as ProductionGrowthFilters["view"])}><MenuItem value="opportunities">Προτεινόμενες καλύψεις</MenuItem><MenuItem value="all">Όλα τα στοιχεία / πελάτες</MenuItem></TextField>}
        {multi("kinds", "Ανάγκη / προτεινόμενη κάλυψη", kinds)}
        {multi("coverageStates", "Κατάσταση κάλυψης", Object.entries(GROWTH_STATES).map(([value, label]) => ({ value, label })))}
        {multi("assetKinds", "Διαθέτει περιουσία / ανάγκη", kinds)}
        {multi("activePolicyTypes", "Έχει ενεργά συμβόλαια", policyKinds)}
        {multi("producerIds", "Συνεργάτης", options("producers"))}
        {multi("cities", "Πόλη", options("city"))}
        {multi("customerStatuses", "Κατάσταση πελάτη", Object.entries(GROWTH_CUSTOMER_STATUSES).map(([value, label]) => ({ value, label })))}
        {visibility.visible("family") && <TextField select size="small" label="Συνδεδεμένη οικογένεια" value={filters.family} onChange={e => update("family", e.target.value)}><MenuItem value="">Όλοι</MenuItem><MenuItem value="with">Με συνδεδεμένα μέλη</MenuItem><MenuItem value="without">Χωρίς συνδεδεμένα μέλη</MenuItem></TextField>}
        {visibility.visible("priorityMin") && <TextField select size="small" label="Ελάχιστη προτεραιότητα" value={filters.priorityMin} onChange={e => update("priorityMin", e.target.value)}><MenuItem value="">Όλες</MenuItem>{[1, 2, 3, 4, 5].map(value => <MenuItem key={value} value={String(value)}>{value} / 5</MenuItem>)}</TextField>}
        {visibility.visible("contactState") && <TextField select size="small" label="Επικοινωνία" value={filters.contactState} onChange={e => update("contactState", e.target.value)}><MenuItem value="">Όλες</MenuItem><MenuItem value="due">Σήμερα / καθυστερημένη</MenuItem><MenuItem value="future">Μελλοντική</MenuItem><MenuItem value="unscheduled">Χωρίς προγραμματισμό</MenuItem></TextField>}
        {visibility.visible("contactFrom") && <TextField size="small" type="date" label="Επόμενη επικοινωνία από" InputLabelProps={{ shrink: true }} value={filters.contactFrom} onChange={e => update("contactFrom", e.target.value)} />}
        {visibility.visible("contactTo") && <TextField size="small" type="date" label="Επόμενη επικοινωνία έως" InputLabelProps={{ shrink: true }} value={filters.contactTo} onChange={e => update("contactTo", e.target.value)} />}
        {visibility.visible("groupBy") && <TextField select size="small" label="Ομαδοποίηση" value={filters.groupBy} onChange={e => update("groupBy", e.target.value as ProductionGrowthFilters["groupBy"])}><MenuItem value="">Χωρίς ομαδοποίηση</MenuItem><MenuItem value="customer">Ανά πελάτη</MenuItem><MenuItem value="kind">Ανά κάλυψη</MenuItem><MenuItem value="city">Ανά πόλη</MenuItem><MenuItem value="producer">Ανά συνεργάτη</MenuItem></TextField>}
        <Stack direction="row" gap={.75}><Button variant="contained" color="error" size="small" startIcon={<FilterAltOffIcon />} onClick={reset}>Καθαρισμός</Button><FilterVisibilityPicker filters={FILTERS} {...visibility} /></Stack>
      </Box>
    </ResponsiveFilterPanel>
    <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={.75} mb={1}><Chip size="small" label={filters.view === "opportunities" ? "Προτεινόμενες καλύψεις" : "Όλα τα καταχωρημένα στοιχεία"} color="info" /><Typography variant="caption" color="text.secondary">Οι προτάσεις βασίζονται μόνο σε καταχωρημένες ανάγκες και χρειάζονται επιβεβαίωση με τον πελάτη.</Typography></Stack>
    <TableToolbar<ProductionGrowthRow> query="" onQuery={() => {}} hideSearch hideCount hidePageSize hideActionButtons snapshotExport
      count={allRows.length} filteredCount={displayRows.length} pageSize={table.pageSize} onPageSize={table.setPageSize}
      exportRows={displayRows} exportFileName="production-growth" columnSelectionId="production-growth" printTitle="Λίστες αύξησης παραγωγής"
      printSubtitle={`${filters.view === "opportunities" ? "Προτεινόμενες καλύψεις" : "Όλα τα στοιχεία"} · ${displayRows.length} εγγραφές${filters.search ? ` · ${filters.search}` : ""}`}
      actionRequest={action} visibleColumnKeys={[...columns.visibleColumns.map(c => c.key), ...(filters.groupBy ? ["group"] : [])]}
      exportColumns={[
        { key: "customer", label: "Πελάτης", map: row => `${row.customerNumber} · ${row.customerName}` },
        { key: "assets", label: "Διαθέτει", map: row => joinKinds(row.assetKinds, NEED_LABEL) },
        { key: "need", label: "Ανάγκη / πρόταση", map: row => `${row.needKind ? NEED_LABEL[row.needKind] ?? row.needKind : ""} · ${row.needTitle}` },
        { key: "state", label: "Κατάσταση κάλυψης", map: row => GROWTH_STATES[row.coverageState] ?? row.coverageState },
        { key: "policies", label: "Ενεργές καλύψεις", map: row => joinKinds(row.activePolicyTypes, GROWTH_POLICY_TYPES) },
        { key: "priority", label: "Προτεραιότητα", map: row => row.needId ? `${row.priority}/5` : "—" },
        { key: "next", label: "Επόμενη επικοινωνία", map: row => shortDate(row.nextContactAt) },
        { key: "contact", label: "Επικοινωνία", map: row => [row.phone, row.email].filter(Boolean).join(" · ") },
        { key: "producer", label: "Συνεργάτης", map: row => row.producers.map(p => p.name).join(", ") },
        { key: "city", label: "Πόλη" }, { key: "family", label: "Οικογένεια", map: row => row.family.map(p => `${p.name} (${RELATION_LABEL[p.relationship] ?? p.relationship})`).join(", ") },
        { key: "notes", label: "Σημειώσεις" }, { key: "reason", label: "Αιτιολογία" },
        { key: "group", label: "Ομαδοποίηση", map: row => growthGroupLabel(row, filters.groupBy) },
      ]} />
    {query.isError && <Alert severity="error" sx={{ mb: 1 }} action={<Button onClick={() => void query.refetch()}>Επανάληψη</Button>}>{extractErrorMessage(query.error)}</Alert>}
    {query.isLoading ? <Box sx={{ py: 5, textAlign: "center" }}><CircularProgress /></Box> : <Card variant="outlined" sx={{ bgcolor: "#f8fafc", borderColor: "#d5e0ec", overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: "min(64vh, 780px)", overflow: "auto" }}>
        <Table size="small" stickyHeader aria-label="Λίστες αύξησης παραγωγής" sx={{ minWidth: 1150, "& th": { bgcolor: "#e9eef4", color: "#102d55", fontWeight: 800 }, "& td, & th": { py: .65, px: 1, borderColor: "#dfe5ed", fontSize: 12.5 }, "& tbody tr:nth-of-type(even)": { bgcolor: "#f0f2f5" }, "& tbody tr:hover": { bgcolor: "#e5edf7" } }}>
          <TableHead><TableRow>{columns.visibleColumns.map(column => <TableCell key={column.key} sx={{ whiteSpace: "nowrap" }}>
            {SORT_FIELDS[column.key] ? <TableSortLabel active={table.sortKey === SORT_FIELDS[column.key]} direction={table.sortKey === SORT_FIELDS[column.key] ? table.sortDir : "asc"} onClick={() => table.toggleSort(SORT_FIELDS[column.key])}>{column.label}</TableSortLabel> : column.label}
          </TableCell>)}<TableCell><ColumnPreferencesButton {...columns} /></TableCell></TableRow></TableHead>
          <TableBody>{pageRows.map((row, index) => <Fragment key={row.id}>
            {filters.groupBy && (index === 0 || growthGroupLabel(pageRows[index - 1], filters.groupBy) !== growthGroupLabel(row, filters.groupBy)) && <TableRow><TableCell colSpan={columns.visibleColumns.length + 1} sx={{ bgcolor: "#dce8f5", fontWeight: 800 }}>{growthGroupLabel(row, filters.groupBy)} · {groupCounts.get(growthGroupLabel(row, filters.groupBy))} εγγραφές</TableCell></TableRow>}
            <TableRow hover>{columns.visibleColumns.map(column => <TableCell key={column.key}>{renderCell(column.key, row)}</TableCell>)}<TableCell><Button size="small" variant="contained" color="success" startIcon={<PersonOutlineIcon />} onClick={() => setCustomer(row)} sx={{ whiteSpace: "nowrap" }}>Καρτέλα</Button></TableCell></TableRow>
          </Fragment>)}{!pageRows.length && <TableRow><TableCell colSpan={columns.visibleColumns.length + 1} sx={{ textAlign: "center", py: "32px !important" }}>{query.isError ? "Η φόρτωση απέτυχε. Πατήστε Επανάληψη." : allRows.length ? "Δεν βρέθηκαν αποτελέσματα. Αλλάξτε τα φίλτρα ή επιλέξτε «Όλα τα στοιχεία / πελάτες»." : "Δεν υπάρχουν καταχωρημένοι πελάτες."}</TableCell></TableRow>}</TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ px: 1, py: .75 }}><NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} totalRows={displayRows.length} pageSize={table.pageSize} onPageSize={table.setPageSize} /></Box>
    </Card>}
    {customer && <CustomerDetailPage key={customer.customerId} customerId={customer.customerId} initialCustomer={{
      id: customer.customerId, customerNumber: customer.customerNumber, type: customer.customerType, status: customer.customerStatus,
      firstName: customer.customerType === "Company" ? undefined : customer.customerName, companyName: customer.customerType === "Company" ? customer.customerName : undefined,
      email: customer.email ?? undefined, phone: customer.phone ?? undefined, city: customer.city,
    }} onClose={() => { setCustomer(null); void query.refetch(); }} />}
  </Box>;
}
