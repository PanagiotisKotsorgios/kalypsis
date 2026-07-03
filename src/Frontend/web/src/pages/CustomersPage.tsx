import { useState } from "react";
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
import { ExportButton } from "../components/ExportButton";
import SearchIcon from "@mui/icons-material/Search";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, extractErrorMessage } from "../api/client";
import { CredentialsDialog } from "./TenantsPage";
import { useTableState } from "../components/useTableState";
import { useColumnPreferences } from "../hooks/useColumnPreferences";
import { ColumnPreferencesButton } from "../components/ColumnPreferencesButton";
import { TableToolbar, NumberedPager } from "../components/TableToolbar";
import { SearchableTextField } from "../components/SearchableTextField";

type CustomerType = "Individual" | "Company";
const NEED_KINDS = ["Home", "Vehicle", "Health", "Life", "Business", "Travel", "Pet", "Liability", "Cyber", "Other"] as const;

interface CustomerDto {
  id: string;
  customerNumber: string;
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  city?: string;
  createdAt: string;
  hasPortalAccount: boolean;
}

interface CreateBody {
  type: CustomerType;
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
  createPortalAccount: boolean;
}

interface CreateResponse {
  customer: CustomerDto;
  portalEmail: string | null;
  portalTemporaryPassword: string | null;
}

export function CustomersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [occupationFilter, setOccupationFilter] = useState("");
  const [needKind, setNeedKind] = useState("");
  const [onlyUninsuredNeeds, setOnlyUninsuredNeeds] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", search, occupationFilter, needKind, onlyUninsuredNeeds],
    queryFn: async () =>
      (await api.get<CustomerDto[]>("/customers", { params: {
        search: search || undefined,
        occupation: occupationFilter || undefined,
        needKind: needKind || undefined,
        onlyUninsuredNeeds: needKind && onlyUninsuredNeeds ? true : undefined
      } })).data
  });

  const createMutation = useMutation({
    mutationFn: async (body: CreateBody) => (await api.post<CreateResponse>("/customers", body)).data,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      if (data.portalEmail && data.portalTemporaryPassword) {
        setCreatedCreds({ email: data.portalEmail, password: data.portalTemporaryPassword });
      }
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
    { key: "portal", label: "Πρόσβαση Portal" },
  ]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h4">{t("customers.title")}</Typography>
          <HelpHint id="page.customers" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Box data-tour="customers-export"><ExportButton href="/api/exports/customers.csv" /></Box>
          <Button data-tour="customers-new" startIcon={<AddIcon />} variant="contained" size="large" onClick={() => { setError(null); setOpen(true); }}>
            {t("customers.create")}
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2, p: 2 }} data-tour="customers-search">
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            placeholder={t("customers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              )
            }}
          />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <TextField size="small" label="Επάγγελμα / κλάδος" value={occupationFilter}
              onChange={(e) => setOccupationFilter(e.target.value)} sx={{ minWidth: { md: 250 } }}
              placeholder="π.χ. εστίαση" />
            <SearchableTextField size="small" label="Ανάγκη / περιουσία" value={needKind}
              onChange={(e) => setNeedKind(e.target.value)} sx={{ minWidth: { md: 210 } }}>
              <MenuItem value="">Όλες</MenuItem>
              {NEED_KINDS.map(kind => <MenuItem key={kind} value={kind}>{kind}</MenuItem>)}
            </SearchableTextField>
            <FormControlLabel control={<Switch checked={onlyUninsuredNeeds} disabled={!needKind}
              onChange={(e) => setOnlyUninsuredNeeds(e.target.checked)} />} label="Μόνο χωρίς ενεργή κάλυψη" />
          </Stack>
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
                    <TableCell key={c.key}>{c.label}</TableCell>
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
                    sx={{ cursor: "pointer" }}
                    onClick={() => { window.location.href = `/app/customers/${c.id}`; }}
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
                              <Typography fontWeight={600}>
                                {c.type === "Individual"
                                  ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
                                  : c.companyName}
                              </Typography>
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
                        case "portal":
                          return (
                            <TableCell key={col.key}>
                              {c.hasPortalAccount ? (
                                <Chip label={t("customers.yes")} size="small" color="success" />
                              ) : (
                                <Chip label={t("customers.no")} size="small" />
                              )}
                            </TableCell>
                          );
                        default: return <TableCell key={col.key}>—</TableCell>;
                      }
                    })}
                    <TableCell />
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
            <NumberedPager page={table.page} totalPages={table.totalPages} onPage={table.setPage} />
          </Box>
        </Card>
      )}

      <CreateCustomerDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(b) => createMutation.mutate(b)}
        submitting={createMutation.isPending}
      />

      <CredentialsDialog
        open={!!createdCreds}
        email={createdCreds?.email ?? ""}
        password={createdCreds?.password ?? ""}
        onClose={() => setCreatedCreds(null)}
        title={t("customers.createdTitle")}
        introKey="customers.createdWithPortal"
      />
    </Box>
  );
}

function CreateCustomerDialog({
  open,
  onClose,
  onSubmit,
  submitting
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (b: CreateBody) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateBody>({
    type: "Individual",
    firstName: "",
    lastName: "",
    companyName: "",
    vatNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    occupation: "",
    notes: "",
    createPortalAccount: true
  });

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

          {form.type === "Individual" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("customers.firstName")}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label={t("customers.lastName")}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                fullWidth
                required
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
              />
              <TextField
                label={t("customers.vatNumber")}
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                fullWidth
                required
              />
            </Stack>
          )}

          <TextField
            label={form.type === "Company" ? "Κλάδος / δραστηριότητα" : "Επάγγελμα"}
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            fullWidth
            placeholder={form.type === "Company" ? "π.χ. Εστίαση, ξενοδοχείο, εμπόριο" : "π.χ. Ελεύθερος επαγγελματίας"}
          />

          <TextField
            label={t("customers.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            required={form.createPortalAccount}
          />
          <TextField
            label={t("customers.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            fullWidth
          />

          <TextField
            label={t("customers.address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label={t("customers.city")}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              fullWidth
            />
            <TextField
              label={t("customers.postalCode")}
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              fullWidth
            />
          </Stack>

          <TextField
            label={t("customers.notes")}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.createPortalAccount}
                onChange={(e) => setForm({ ...form, createPortalAccount: e.target.checked })}
              />
            }
            label={t("customers.createPortalAccount")}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? <CircularProgress size={18} /> : t("common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
