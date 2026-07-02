import { useDeferredValue, useState, type ReactNode } from "react";
import { HelpHint } from "../components/HelpHint";
import {
  Alert,
  Box,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import GroupIcon from "@mui/icons-material/Group";
import HistoryIcon from "@mui/icons-material/History";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SearchableTextField } from "../components/SearchableTextField";

interface AuditLog {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  userId: string | null;
  userEmail: string | null;
  entityName: string;
  entityId: string;
  action: string;
  category: string;
  pagePath: string | null;
  target: string | null;
  metadata: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogPage {
  items: AuditLog[];
  totalCount: number;
  page: number;
  pageSize: number;
  todayCount: number;
  todayEmployeeCount: number;
}

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  Authentication: "Σύνδεση & ασφάλεια",
  Data: "Μεταβολή δεδομένων",
  Navigation: "Πλοήγηση",
  Click: "Κλικ",
  Search: "Αναζήτηση",
  Form: "Φόρμα",
  System: "Σύστημα"
};

const ACTION_LABEL: Record<string, string> = {
  Login: "Επιτυχής σύνδεση",
  LoginFailed: "Αποτυχημένη σύνδεση",
  LoginBlocked: "Αποκλεισμένη σύνδεση",
  Create: "Δημιουργία",
  Update: "Ενημέρωση",
  Delete: "Διαγραφή",
  "Άνοιγμα σελίδας": "Άνοιγμα σελίδας",
  "Κλικ": "Κλικ",
  "Αναζήτηση": "Αναζήτηση",
  "Αλλαγή πεδίου": "Αλλαγή πεδίου",
  "Υποβολή φόρμας": "Υποβολή φόρμας"
};

const CATEGORY_COLOR: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  Authentication: "warning",
  Data: "success",
  Navigation: "info",
  Click: "default",
  Search: "info",
  Form: "info",
  System: "default"
};

export function AuditLogsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [entityName, setEntityName] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const deferredSearch = useDeferredValue(search);

  const employeesQuery = useQuery({
    queryKey: ["audit-employees"],
    queryFn: async () => (await api.get<Employee[]>("/users")).data,
    enabled: user?.role === "AgencyAdmin"
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs", deferredSearch, entityName, category, action, userId, from, to, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page + 1), pageSize: String(pageSize) };
      if (deferredSearch) params.search = deferredSearch;
      if (entityName) params.entityName = entityName;
      if (category) params.category = category;
      if (action) params.action = action;
      if (userId) params.userId = userId;
      if (from) params.from = from;
      if (to) params.to = to;
      return (await api.get<AuditLogPage>("/audit-logs", { params })).data;
    }
  });

  const data = auditQuery.data;
  const resetPage = () => setPage(0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Ιστορικό ενεργειών προσωπικού
        </Typography>
        <HelpHint id="page.audit" />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Πλήρες αρχείο για το ποιος έκανε τι, πότε και από ποια σελίδα. Οι τιμές που πληκτρολογούνται σε φόρμες και αναζητήσεις δεν αποθηκεύονται.
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
        <Metric icon={<HistoryIcon color="primary" />} value={data?.todayCount ?? 0} label="Ενέργειες σήμερα" />
        <Metric icon={<GroupIcon color="primary" />} value={data?.todayEmployeeCount ?? 0} label="Ενεργοί χρήστες σήμερα" />
        <Metric icon={<ManageSearchIcon color="primary" />} value={data?.totalCount ?? 0} label="Αποτελέσματα φίλτρων" />
      </Stack>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
            <TextField
              label="Γρήγορη αναζήτηση"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Υπάλληλος, ενέργεια, σελίδα ή στόχος"
              fullWidth
              size="small"
              inputProps={{ "data-audit-search": "audit-log-search" }}
            />
            <SearchableTextField
              select
              label="Υπάλληλος"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); resetPage(); }}
              sx={{ minWidth: { lg: 230 } }}
              size="small"
            >
              <MenuItem value="">Όλοι οι υπάλληλοι</MenuItem>
              {(employeesQuery.data ?? []).map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} — {employee.email}
                </MenuItem>
              ))}
            </SearchableTextField>
            <SearchableTextField
              select
              label="Κατηγορία"
              value={category}
              onChange={(e) => { setCategory(e.target.value); resetPage(); }}
              sx={{ minWidth: { lg: 190 } }}
              size="small"
            >
              <MenuItem value="">Όλες οι κατηγορίες</MenuItem>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </SearchableTextField>
          </Stack>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
            <SearchableTextField
              select
              label="Ενέργεια"
              value={action}
              onChange={(e) => { setAction(e.target.value); resetPage(); }}
              sx={{ minWidth: { lg: 230 } }}
              size="small"
            >
              <MenuItem value="">Όλες οι ενέργειες</MenuItem>
              {Object.entries(ACTION_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </SearchableTextField>
            <TextField
              label="Εγγραφή / ενότητα"
              value={entityName}
              onChange={(e) => { setEntityName(e.target.value); resetPage(); }}
              placeholder="π.χ. Policy, Customer"
              fullWidth
              size="small"
            />
            <TextField
              label="Από ημερομηνία"
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); resetPage(); }}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              label="Έως ημερομηνία"
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); resetPage(); }}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Stack>
        </Stack>
      </Card>

      {auditQuery.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : auditQuery.isError ? (
        <Alert severity="error">Δεν ήταν δυνατή η φόρτωση του ιστορικού ενεργειών.</Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 940 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Χρόνος</TableCell>
                  <TableCell>Υπάλληλος</TableCell>
                  <TableCell>Ενέργεια</TableCell>
                  <TableCell>Στόχος / εγγραφή</TableCell>
                  <TableCell>Σελίδα</TableCell>
                  <TableCell>Γραφείο</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.items ?? []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(row.createdAt).toLocaleString("el-GR")}
                    </TableCell>
                    <TableCell>{row.userEmail ?? "Σύστημα"}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Chip label={CATEGORY_LABEL[row.category] ?? row.category} color={CATEGORY_COLOR[row.category] ?? "default"} size="small" />
                        <Typography variant="caption">{ACTION_LABEL[row.action] ?? row.action}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.target ?? entityLabel(row.entityName)}</Typography>
                      {row.entityName !== "EmployeeActivity" && row.entityName !== "Authentication" && (
                        <Typography variant="caption" color="text.secondary">{entityLabel(row.entityName)} · {row.entityId.slice(0, 8)}</Typography>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="caption">{row.pagePath ?? "—"}</Typography></TableCell>
                    <TableCell>{row.tenantName ?? "Κεντρικό"}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Προβολή λεπτομερειών">
                        <IconButton size="small" aria-label="Προβολή λεπτομερειών ενέργειας" onClick={() => setDetail(row)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={7}><Typography color="text.secondary" textAlign="center" py={4}>Δεν βρέθηκαν ενέργειες με τα επιλεγμένα φίλτρα.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.totalCount ?? 0}
            page={page}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100, 200]}
            labelRowsPerPage="Εγγραφές ανά σελίδα:"
            labelDisplayedRows={({ from: rowFrom, to: rowTo, count }) => `${rowFrom}–${rowTo} από ${count}`}
          />
        </Card>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Λεπτομέρειες ενέργειας</Typography>
            {detail && <Chip label={CATEGORY_LABEL[detail.category] ?? detail.category} color={CATEGORY_COLOR[detail.category] ?? "default"} size="small" />}
            <Box sx={{ flex: 1 }} />
            <IconButton aria-label="Κλείσιμο λεπτομερειών" onClick={() => setDetail(null)}><CloseIcon /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {new Date(detail.createdAt).toLocaleString("el-GR")} · {detail.userEmail ?? "Σύστημα"}
              </Typography>
              <DetailRow label="Ενέργεια" value={ACTION_LABEL[detail.action] ?? detail.action} />
              <DetailRow label="Στόχος" value={detail.target ?? entityLabel(detail.entityName)} />
              <DetailRow label="Σελίδα" value={detail.pagePath ?? "—"} />
              <DetailRow label="IP" value={detail.ipAddress ?? "Δεν διατέθηκε"} />
              {detail.userAgent && <DetailRow label="Συσκευή / browser" value={detail.userAgent} />}
              <Divider />
              <JsonBlock title="Πριν τη μεταβολή" value={detail.oldValues} tone="error" />
              <JsonBlock title="Μετά τη μεταβολή" value={detail.newValues} tone="success" />
              <JsonBlock title="Τεχνικό πλαίσιο" value={detail.metadata} tone="info" />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <Card sx={{ p: 1.75, flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        {icon}
        <Box><Typography variant="h5" sx={{ fontWeight: 800 }}>{value.toLocaleString("el-GR")}</Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box>
      </Stack>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <Box><Typography variant="overline" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{value}</Typography></Box>;
}

function JsonBlock({ title, value, tone }: { title: string; value: string | null; tone: "error" | "success" | "info" }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="overline" color={`${tone}.main`}>{title}</Typography>
      <Box sx={{ p: 1.5, bgcolor: tone === "error" ? "#fdf3f3" : tone === "success" ? "#f3faf3" : "#f2f8ff", border: "1px solid", borderColor: `${tone}.light`, borderRadius: 1, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", overflowX: "auto" }}>
        {pretty(value)}
      </Box>
    </Box>
  );
}

function entityLabel(entityName: string) {
  if (entityName === "EmployeeActivity") return "Ενέργεια διεπαφής";
  if (entityName === "Authentication") return "Σύνδεση χρήστη";
  return entityName.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function pretty(value: string) {
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
