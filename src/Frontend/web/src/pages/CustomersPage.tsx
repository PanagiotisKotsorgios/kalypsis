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
import { TableToolbar, NumberedPager } from "../components/TableToolbar";

type CustomerType = "Individual" | "Company";

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
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", search],
    queryFn: async () =>
      (await api.get<CustomerDto[]>("/customers", { params: search ? { search } : {} })).data
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
                  <TableCell>{t("customers.customerNumber")}</TableCell>
                  <TableCell>{t("customers.type")}</TableCell>
                  <TableCell>{t("users.fullName")}</TableCell>
                  <TableCell>{t("customers.email")}</TableCell>
                  <TableCell>{t("customers.phone")}</TableCell>
                  <TableCell>{t("customers.city")}</TableCell>
                  <TableCell>{t("customers.portalAccount")}</TableCell>
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
                    <TableCell><Chip label={c.customerNumber} size="small" variant="outlined" /></TableCell>
                    <TableCell>
                      {c.type === "Individual" ? t("customers.individual") : t("customers.company")}
                    </TableCell>
                    <TableCell>
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
                    <TableCell>{c.email ?? "-"}</TableCell>
                    <TableCell>{c.phone ?? "-"}</TableCell>
                    <TableCell>{c.city ?? "-"}</TableCell>
                    <TableCell>
                      {c.hasPortalAccount ? (
                        <Chip label={t("customers.yes")} size="small" color="success" />
                      ) : (
                        <Chip label={t("customers.no")} size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
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
          <TextField
            select
            label={t("customers.type")}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CustomerType })}
            fullWidth
          >
            <MenuItem value="Individual">{t("customers.individual")}</MenuItem>
            <MenuItem value="Company">{t("customers.company")}</MenuItem>
          </TextField>

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
            label={t("customers.email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            fullWidth
            required
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
