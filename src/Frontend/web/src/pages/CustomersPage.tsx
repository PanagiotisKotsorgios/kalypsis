import { useEffect, useState } from "react";
import { HelpHint } from "../components/HelpHint";
import { FilterHelp, FilterFieldWrap } from "../components/FilterHelp";
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
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
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
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import { IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { useTableState } from "../components/useTableState";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { useHeaderContextMenu, useRowContextMenu, type ColumnType } from "../components/TableContextMenu";
import { SearchableTextField } from "../components/SearchableTextField";

type CustomerType = "Individual" | "Company";
type CustomerStatus = "Prospect" | "Active" | "Inactive" | "Churned" | "Blocked";
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;
// Localise the Ανάγκη / περιουσία dropdown values into Greek — the enum
// names ship straight to the API but the operator sees the label.
const NEED_KIND_LABEL: Record<string, string> = {
  Home: "Κατοικία", Vehicle: "Όχημα", Health: "Υγεία", Life: "Ζωή",
  Business: "Επιχείρηση", Travel: "Ταξίδι", Pet: "Κατοικίδιο",
  Liability: "Ευθύνη", Cyber: "Cyber", Other: "Άλλο",
};
const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  Prospect: "Πιθανός πελάτης",
  Active: "Ενεργός",
  Inactive: "Ανενεργός",
  Churned: "Απώλεια",
  Blocked: "Αποκλεισμένος",
};

interface CustomerDto {
  id: string;
  customerNumber: string;
  type: CustomerType;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  city?: string;
  createdAt: string;
}

interface CreateBody {
  type: CustomerType;
  status: CustomerStatus;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  occupation?: string;
  notes?: string;
}

function newCustomerForm(status: CustomerStatus): CreateBody {
  return {
    type: "Individual", status,
    firstName: "", lastName: "", companyName: "", vatNumber: "",
    email: "", phone: "", address: "", city: "", postalCode: "",
    occupation: "", notes: ""
  };
}

export function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [needKind, setNeedKind] = useState("");
  const [onlyUninsuredNeeds, setOnlyUninsuredNeeds] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "">("");
  const [createStatus, setCreateStatus] = useState<CustomerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", search, occupationFilter, needKind, onlyUninsuredNeeds, statusFilter],
    queryFn: async () =>
      (await api.get<CustomerDto[]>("/customers", { params: {
        search: search || undefined,
        occupation: occupationFilter || undefined,
        needKind: needKind || undefined,
        onlyUninsuredNeeds: needKind && onlyUninsuredNeeds ? true : undefined,
        status: statusFilter || undefined
      } })).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => api.post("/customers", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setCreateStatus(null);
    },
    onError: (err) => setError(extractErrorMessage(err))
  });

  const allCustomers = customersQuery.data ?? [];
  const table = useTableState<CustomerDto>({
    rows: allCustomers,
    searchableText: (c) => `${c.customerNumber} ${c.firstName ?? ""} ${c.lastName ?? ""} ${c.companyName ?? ""} ${c.vatNumber ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.city ?? ""}`,
    pageSize: 25
  });
  const customers = table.paged;
  const customerCols = useColumnPreferences("customers", [
    { key: "number", label: "Αρ. Πελάτη", alwaysVisible: true },
    { key: "type",   label: "Τύπος" },
    { key: "name",   label: "Ονοματεπώνυμο / Επωνυμία" },
    { key: "email",  label: "Email" },
    { key: "phone",  label: "Τηλέφωνο" },
    { key: "city",   label: "Πόλη", defaultVisible: false },
  ]);

  // Right-click on a header → sort (Α→Ω / Ω→Α) + «Απόκρυψη στήλης» (via
  // the existing column-preferences hook). Right-click on a row → open
  // the customer detail page in a new tab or delete the customer.
  const inferColumnType = (key: string): ColumnType => {
    if (key === "number") return "string";
    return "string";
  };
  const headerMenu = useHeaderContextMenu({
    onSort: (key, dir) => {
      // useTableState only supports keys that exist on the DTO; map friendly
      // column keys back to the underlying field so sorting works everywhere.
      const map: Record<string, keyof CustomerDto> = {
        number: "customerNumber", type: "type", name: "lastName",
        email: "email", phone: "phone", city: "city",
      };
      const dtoKey = map[key];
      if (dtoKey) {
        table.toggleSort(dtoKey);
        // toggleSort only alternates dir; force the direction picked from the menu.
        if (table.sortDir !== dir) table.toggleSort(dtoKey);
      }
    },
    onHide: (key) => customerCols.toggleVisibility(key),
  });
  // Explicit deleter — the delete endpoint refuses if the customer has
  // policies / receipts attached; the API's friendly why/fix bubbles up
  // through extractErrorMessage so the operator sees "Ο πελάτης έχει N
  // ενεργά συμβόλαια — δεν διαγράφεται." instead of a generic 400.
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["customers"] }),
    onError: e => setError(extractErrorMessage(e))
  });

  const rowMenu = useRowContextMenu<CustomerDto>({
    entityLabel: "πελάτη",
    onEdit: (c) => { window.location.href = `/app/customers/${c.id}`; },
    onDelete: (c) => {
      const label = c.type === "Individual"
        ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
        : c.companyName || c.customerNumber;
      if (confirm(`Διαγραφή πελάτη «${label}»;\n\nΘα αποτύχει αν έχει συμβόλαια ή αποδείξεις.`)) del.mutate(c.id);
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("customers.title")}</Typography>
          <HelpHint id="page.customers" />
        </Stack>
        <Stack direction="row" spacing={1}>
          {/* Export handled by the TableToolbar dropdown below — the old
              header ExportButton was a duplicate CSV-only shortcut. */}
          <Button variant="outlined" size="large" onClick={() => { setError(null); setCreateStatus("Prospect"); }}>
            Πιθανός πελάτης
          </Button>
          <Button data-tour="customers-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setCreateStatus("Active"); }}>
            {t("customers.create")}
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2, px: 1.5, py: 1.25 }} data-tour="customers-search">
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder={t("customers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment>,
              endAdornment: <FilterHelp title="Αναζήτηση σε όνομα, ΑΦΜ, email, τηλέφωνο, αρ. πελάτη ή πόλη." />
            }}
          />
          <FilterFieldWrap tip="Ελεύθερο κείμενο για επάγγελμα ή κλάδο δραστηριότητας (π.χ. «εστίαση»).">
            <TextField size="small" label="Επάγγελμα / κλάδος" value={occupationFilter}
              onChange={(e) => setOccupationFilter(e.target.value)} sx={{ minWidth: 190, width: "100%" }}
              placeholder="π.χ. εστίαση" />
          </FilterFieldWrap>
          <FilterFieldWrap tip="Φιλτράρετε τους πελάτες βάσει ασφαλιστικής ανάγκης ή περιουσιακού στοιχείου.">
            <SearchableTextField size="small" label="Ανάγκη / περιουσία" value={needKind}
              onChange={(e) => setNeedKind(e.target.value)} sx={{ minWidth: 180, width: "100%" }}>
              <MenuItem value="">Όλες</MenuItem>
              {NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{NEED_KIND_LABEL[kind] ?? kind}</MenuItem>)}
            </SearchableTextField>
          </FilterFieldWrap>
          <FormControlLabel control={<Switch checked={onlyUninsuredNeeds} disabled={!needKind}
            onChange={(e) => setOnlyUninsuredNeeds(e.target.checked)} />} label="Μόνο χωρίς κάλυψη" />
          <SearchableTextField select size="small" label="Κατάσταση" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | "")} sx={{ minWidth: 160, width: "100%" }}>
            <MenuItem value="">Όλες</MenuItem>
            {Object.entries(CUSTOMER_STATUS_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </SearchableTextField>
        </Stack>
      </Card>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TableToolbar<CustomerDto>
          query={table.query} onQuery={table.setQuery}
          count={allCustomers.length} filteredCount={table.filtered.length}
          pageSize={table.pageSize} onPageSize={table.setPageSize}
          exportRows={table.filtered}
          exportFileName={`customers-${new Date().toISOString().slice(0, 10)}`}
          serverEntity="customers"
          serverParams={{ search: table.query }}
          exportColumns={[
            { key: "customerNumber", label: "Αρ. Πελάτη" },
            { key: "type", label: "Τύπος" },
            { key: "firstName", label: "Όνομα" },
            { key: "lastName", label: "Επώνυμο" },
            { key: "companyName", label: "Επωνυμία" },
            { key: "vatNumber", label: "ΑΦΜ" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Τηλέφωνο" },
            { key: "city", label: "Πόλη" }
          ]}
        />
      </Box>
      {customersQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card data-tour="customers-table">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {customerCols.visibleColumns.map(c => (
                    <TableCell
                      key={c.key}
                      onContextMenu={(e) => headerMenu.open(e, {
                        key: c.key, label: c.label, type: inferColumnType(c.key), canHide: !c.alwaysVisible,
                      })}
                      sx={{ userSelect: "none" }}
                    >
                      {c.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" padding="checkbox">
                    <ColumnPreferencesButton
                      orderedColumns={customerCols.orderedColumns}
                      hiddenSet={customerCols.hiddenSet}
                      toggleVisibility={customerCols.toggleVisibility}
                      moveColumn={customerCols.moveColumn}
                      reset={customerCols.reset}
                    />
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={c.status === "Prospect" ? {
                      cursor: "pointer",
                      bgcolor: "rgba(245, 158, 11, 0.12)",
                      "&:hover": { bgcolor: "rgba(245, 158, 11, 0.20)" }
                    } : { cursor: "pointer" }}
                    onClick={() => { window.location.href = `/app/customers/${c.id}`; }}
                    onContextMenu={(e) => rowMenu.open(e, c)}
                  >
                    {customerCols.visibleColumns.map(col => {
                      switch (col.key) {
                        case "number":
                          return <TableCell key={col.key}><Chip label={c.customerNumber} size="small" variant="outlined" /></TableCell>;
                        case "type":
                          return <TableCell key={col.key}>{c.type === "Individual" ? t("customers.individual") : t("customers.company")}</TableCell>;
                        case "name":
                          return (
                            <TableCell key={col.key}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography fontWeight={600}>
                                  {c.type === "Individual"
                                    ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                                    : c.companyName}
                                </Typography>
                                {c.status === "Prospect" && <Chip label="Πιθανός πελάτης" size="small" color="warning" />}
                              </Stack>
                              {c.vatNumber && (
                                <Typography variant="caption" color="text.secondary">
                                  ΑΦΜ: {c.vatNumber}
                                </Typography>
                              )}
                            </TableCell>
                          );
                        case "email":
                          return <TableCell key={col.key}>{c.email ?? "-"}</TableCell>;
                        case "phone":
                          return <TableCell key={col.key}>{c.phone ?? "-"}</TableCell>;
                        case "city":
                          return <TableCell key={col.key}>{c.city ?? "-"}</TableCell>;
                        default: return <TableCell key={col.key}>—</TableCell>;
                      }
                    })}
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Επεξεργασία">
                        <IconButton size="small"
                          onClick={() => { window.location.href = `/app/customers/${c.id}`; }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Διαγραφή">
                        <IconButton size="small" color="error"
                          onClick={() => {
                            const label = c.type === "Individual"
                              ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber
                              : c.companyName || c.customerNumber;
                            if (confirm(`Διαγραφή πελάτη «${label}»;\n\nΘα αποτύχει αν έχει συμβόλαια ή αποδείξεις.`)) del.mutate(c.id);
                          }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={customerCols.visibleColumns.length + 1}>
                      <Typography color="text.secondary" textAlign="center" py={4}>
                        {t("customers.noCustomers")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage}
              totalRows={table.filtered.length} pageSize={table.pageSize} />
          </Box>
        </Card>
      )}
      {headerMenu.menu}
      {rowMenu.menu}

      <CreateCustomerDialog
        open={createStatus !== null}
        initialStatus={createStatus ?? "Active"}
        onClose={() => setCreateStatus(null)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />

    </Box>
  );
}

function CreateCustomerDialog({
  open,
  initialStatus,
  onClose,
  onSubmit,
  submitting
}: {
  open: boolean;
  initialStatus: CustomerStatus;
  onClose: () => void;
  onSubmit: (b: CreateBody) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateBody>(() => newCustomerForm(initialStatus));
  useEffect(() => {
    if (open) {
      setForm(newCustomerForm(initialStatus));
    }
  }, [open, initialStatus]);

  const handleSubmit = () => {
    const payload: CreateBody = {
      ...form,
      firstName: form.type === "Individual" ? form.firstName : undefined,
      lastName: form.type === "Individual" ? form.lastName : undefined,
      companyName: form.type === "Company" ? form.companyName : undefined,
      vatNumber: form.type === "Company" ? form.vatNumber : undefined
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("customers.createTitle")}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" mb={2}>
          {t("customers.createHelp")}
        </Typography>
        <Stack spacing={2} mt={1}>
          <SearchableTextField
            select
            label={t("customers.type")}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}
            fullWidth
          >
            <MenuItem value="Individual">{t("customers.individual")}</MenuItem>
            <MenuItem value="Company">{t("customers.company")}</MenuItem>
          </SearchableTextField>

          <FormControlLabel
            control={<Switch checked={form.status === "Prospect"} onChange={(e) => setForm({
              ...form,
              status: e.target.checked ? "Prospect" : "Active"
            })} />}
            label="Πιθανός πελάτης"
          />
          {form.status === "Prospect" && (
            <Alert severity="info">Θα εμφανίζεται με ειδική επισήμανση στις λίστες.</Alert>
          )}

          {form.type === "Individual" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("customers.firstName")}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                fullWidth
                required
                InputProps={{ endAdornment: <FilterHelp title="Όνομα πελάτη — όπως αναγράφεται στην αστυνομική ταυτότητα." /> }}
              />
              <TextField
                label={t("customers.lastName")}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                fullWidth
                required
                InputProps={{ endAdornment: <FilterHelp title="Επώνυμο πελάτη — όπως αναγράφεται στην αστυνομική ταυτότητα." /> }}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("customers.companyName")}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                fullWidth
                required
                InputProps={{ endAdornment: <FilterHelp title="Επίσημη επωνυμία επιχείρησης όπως εμφανίζεται στα ΓΕΜΗ / τιμολόγια." /> }}
              />
              <TextField
                label={t("customers.vatNumber")}
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                fullWidth
                required={form.status !== "Prospect"}
                InputProps={{ endAdornment: <FilterHelp title="ΑΦΜ επιχείρησης (9 ψηφία). Χρησιμοποιείται σε τιμολόγηση και έλεγχο διπλοεγγραφών." /> }}
              />
            </Stack>
          )}

          <TextField
            label={form.type === "Company" ? "Κλάδος / δραστηριότητα" : "Επάγγελμα"}
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            fullWidth
            placeholder={form.type === "Company" ? "π.χ. Εστίαση, ξενοδοχείο, εμπόριο" : "π.χ. Ελεύθερος επαγγελματίας"}
            InputProps={{ endAdornment: <FilterHelp title={form.type === "Company" ? "Κλάδος δραστηριότητας — βοηθά σε ανάλυση χαρτοφυλακίου ανά τομέα." : "Επάγγελμα πελάτη — αξιοποιείται σε cross-sell προτάσεις."} /> }}
          />

          <TextField
            label={t("customers.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Email πελάτη. Χρησιμοποιείται για αποστολή συμβολαίων, ανανεώσεων και άλλων ειδοποιήσεων." /> }}
          />
          <TextField
            label={t("customers.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Τηλέφωνο επικοινωνίας. Χρησιμοποιείται σε SMS ειδοποιήσεις και CRM δραστηριότητες." /> }}
          />

          <TextField
            label={t("customers.address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            fullWidth
            InputProps={{ endAdornment: <FilterHelp title="Διεύθυνση αλληλογραφίας — οδός και αριθμός." /> }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("customers.city")}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Πόλη κατοικίας/έδρας. Χρησιμοποιείται σε φίλτρα και reports ανά περιοχή." /> }}
            />
            <TextField
              label={t("customers.postalCode")}
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              fullWidth
              InputProps={{ endAdornment: <FilterHelp title="Ταχυδρομικός Κώδικας (5 ψηφία)." /> }}
            />
          </Stack>

          <TextField
            label={t("customers.notes")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
            InputProps={{ endAdornment: <FilterHelp title="Προαιρετικά εσωτερικά σχόλια για τον πελάτη — προτιμήσεις, ιστορικό, ειδικές συμφωνίες." /> }}
          />

        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} variant="contained"
          disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
